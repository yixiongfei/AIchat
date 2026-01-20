
import { lettaClient } from "./client";
import pool from "../storage/db";
import { v4 as uuidv4 } from "uuid";

type MemoryBlock = { label: string; value?: string | null };
type CloudAgent = {
  id: string;
  name: string;
  memoryBlocks?: MemoryBlock[];
};

export const agentService = {
  // 从 Letta Cloud 同步 Agent 数据到本地数据库
  // ✅ 新增 pruneDeleted: 同步成功后是否清理本地已不存在于云端的记录（默认 true）
  async syncFromCloud(pruneDeleted: boolean = true) {
    try {
      // 1) 拉取云端列表（当前存在的 agent）
      const cloudAgents = (await lettaClient.agents.list()) as CloudAgent[]; // Letta SDK 支持 list() 获取 agents [1](https://deepwiki.com/letta-ai/letta/10.2-typescript-sdk)[2](https://docs.letta.com/api/typescript)

      // 2) 预先构建云端 id 集合（用于 prune）
      const cloudIdSet = new Set(cloudAgents.map(a => a.id));

      // 3) Upsert：逐个写入本地
      for (const agent of cloudAgents) {
        const persona =
          agent.memoryBlocks?.find((b: MemoryBlock) => b.label === "persona")?.value ?? "";
        const human =
          agent.memoryBlocks?.find((b: MemoryBlock) => b.label === "human")?.value ?? "";

        const [rows]: any = await pool.query(
          "SELECT id FROM agents WHERE agent_id = ?",
          [agent.id]
        );

        if (rows.length === 0) {
          await pool.query(
            "INSERT INTO agents (id, name, persona, human, agent_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
            [uuidv4(), agent.name, persona, human, agent.id, Date.now()]
          );
        } else {
          await pool.query(
            "UPDATE agents SET name = ?, persona = ?, human = ? WHERE agent_id = ?",
            [agent.name, persona, human, agent.id]
          );
        }
      }

      // ✅ 4) PRUNE：清理本地“云端已删除”的 agent（关键修复点）
      // 只有在成功拿到 cloudAgents 后才做，避免云端临时失败导致误删全部
      let deletedCount = 0;

      if (pruneDeleted) {
        const [localRows]: any = await pool.query("SELECT agent_id FROM agents");
        const localIds: string[] = (localRows ?? []).map((r: any) => r.agent_id);

        const staleIds = localIds.filter(id => !cloudIdSet.has(id));

        // 分批删除（避免 IN 过长）
        const BATCH = 500;
        for (let i = 0; i < staleIds.length; i += BATCH) {
          const batch = staleIds.slice(i, i + BATCH);
          const placeholders = batch.map(() => "?").join(",");

          // mysql2 pool.query 支持参数化数组传参 [3](https://sidorares.github.io/node-mysql2/docs)[4](https://www.netjstech.com/2024/08/nodejs-mysql-delete-example.html)
          const [result]: any = await pool.query(
            `DELETE FROM agents WHERE agent_id IN (${placeholders})`,
            batch
          );

          // affectedRows 在不同返回结构里可能不同，这里尽量兼容
          deletedCount += result?.affectedRows ?? 0;
        }
      }

      return {
        success: true,
        count: cloudAgents.length,
        pruned: pruneDeleted,
        deletedCount,
      };
    } catch (error) {
      console.error("Sync from cloud failed:", error);
      throw error;
    }
  },

  async createRole(name: string, persona: string, human: string) {
    const agent = await lettaClient.agents.create({
      name,
      memoryBlocks: [
        { label: "persona", value: persona },
        { label: "human", value: human },
      ],
      model: "openai/gpt-4o-mini",
      embedding: "openai/text-embedding-3-small",
    });

    const id = uuidv4();
    const createdAt = Date.now();
    await pool.query(
      "INSERT INTO agents (id, name, persona, human, agent_id, created_at) VALUES (?, ?, ?, ?, ?, ?)",
      [id, name, persona, human, agent.id, createdAt]
    );

    return { id, name, persona, human, agentId: agent.id, createdAt };
  },

  async listRoles() {
    const [rows]: any = await pool.query("SELECT * FROM agents ORDER BY created_at DESC");
    return rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      persona: row.persona,
      human: row.human,
      agentId: row.agent_id,
      createdAt: row.created_at,
    }));
  },

  async getRole(id: string) {
    const [rows]: any = await pool.query("SELECT * FROM agents WHERE id = ?", [id]);
    if (rows.length === 0) return null;
    const row = rows[0];
    return {
      id: row.id,
      name: row.name,
      persona: row.persona,
      human: row.human,
      agentId: row.agent_id,
      createdAt: row.created_at,
    };
  },
};
