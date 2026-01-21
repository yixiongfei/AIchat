"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentService = void 0;
const client_1 = require("./client");
const db_1 = __importDefault(require("../storage/db"));
const uuid_1 = require("uuid");
exports.agentService = {
    // 从 Letta Cloud 同步 Agent 数据到本地数据库
    // ✅ 新增 pruneDeleted: 同步成功后是否清理本地已不存在于云端的记录（默认 true）
    async syncFromCloud(pruneDeleted = true) {
        try {
            // 1) 拉取云端列表（当前存在的 agent）
            const cloudAgents = (await client_1.lettaClient.agents.list()); // Letta SDK 支持 list() 获取 agents [1](https://deepwiki.com/letta-ai/letta/10.2-typescript-sdk)[2](https://docs.letta.com/api/typescript)
            // 2) 预先构建云端 id 集合（用于 prune）
            const cloudIdSet = new Set(cloudAgents.map(a => a.id));
            // 3) Upsert：逐个写入本地
            for (const agent of cloudAgents) {
                const persona = agent.memoryBlocks?.find((b) => b.label === "persona")?.value ?? "";
                const human = agent.memoryBlocks?.find((b) => b.label === "human")?.value ?? "";
                const [rows] = await db_1.default.query("SELECT id FROM agents WHERE agent_id = ?", [agent.id]);
                if (rows.length === 0) {
                    await db_1.default.query("INSERT INTO agents (id, name, persona, human, agent_id, created_at) VALUES (?, ?, ?, ?, ?, ?)", [(0, uuid_1.v4)(), agent.name, persona, human, agent.id, Date.now()]);
                }
                else {
                    await db_1.default.query("UPDATE agents SET name = ?, persona = ?, human = ? WHERE agent_id = ?", [agent.name, persona, human, agent.id]);
                }
            }
            // ✅ 4) PRUNE：清理本地“云端已删除”的 agent（关键修复点）
            // 只有在成功拿到 cloudAgents 后才做，避免云端临时失败导致误删全部
            let deletedCount = 0;
            if (pruneDeleted) {
                const [localRows] = await db_1.default.query("SELECT agent_id FROM agents");
                const localIds = (localRows ?? []).map((r) => r.agent_id);
                const staleIds = localIds.filter(id => !cloudIdSet.has(id));
                // 分批删除（避免 IN 过长）
                const BATCH = 500;
                for (let i = 0; i < staleIds.length; i += BATCH) {
                    const batch = staleIds.slice(i, i + BATCH);
                    const placeholders = batch.map(() => "?").join(",");
                    // mysql2 pool.query 支持参数化数组传参 [3](https://sidorares.github.io/node-mysql2/docs)[4](https://www.netjstech.com/2024/08/nodejs-mysql-delete-example.html)
                    const [result] = await db_1.default.query(`DELETE FROM agents WHERE agent_id IN (${placeholders})`, batch);
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
        }
        catch (error) {
            console.error("Sync from cloud failed:", error);
            throw error;
        }
    },
    async createRole(name, persona, human, voice, speed, pitch, style) {
        const agent = await client_1.lettaClient.agents.create({
            name,
            memoryBlocks: [
                { label: "persona", value: persona },
                { label: "human", value: human },
            ],
            model: "openai/gpt-4o-mini",
            embedding: "openai/text-embedding-3-small",
        });
        const id = (0, uuid_1.v4)();
        const createdAt = Date.now();
        await db_1.default.query("INSERT INTO agents (id, name, persona, human, agent_id, voice, speed, pitch, style, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [id, name, persona, human, agent.id, voice || 'ja-JP-MayuNeural', speed || 1.0, pitch || '15', style || 'chat', createdAt]);
        return { id, name, persona, human, agentId: agent.id, voice, speed, pitch, style, createdAt };
    },
    async listRoles() {
        const [rows] = await db_1.default.query("SELECT * FROM agents ORDER BY created_at DESC");
        return rows.map((row) => ({
            id: row.id,
            name: row.name,
            persona: row.persona,
            human: row.human,
            agentId: row.agent_id,
            voice: row.voice,
            speed: row.speed,
            pitch: row.pitch,
            style: row.style,
            createdAt: row.created_at,
        }));
    },
    async getRole(id) {
        const [rows] = await db_1.default.query("SELECT * FROM agents WHERE id = ?", [id]);
        if (rows.length === 0)
            return null;
        const row = rows[0];
        return {
            id: row.id,
            name: row.name,
            persona: row.persona,
            human: row.human,
            agentId: row.agent_id,
            voice: row.voice,
            speed: row.speed,
            pitch: row.pitch,
            style: row.style,
            createdAt: row.created_at,
        };
    },
};
