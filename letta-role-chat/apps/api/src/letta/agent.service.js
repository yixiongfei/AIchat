"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.agentService = void 0;
const client_1 = require("./client");
const db_1 = __importDefault(require("../storage/db"));
const uuid_1 = require("uuid");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
exports.agentService = {
    // 从 Letta Cloud 同步 Agent 数据到本地数据库
    // ✅ 新增 pruneDeleted: 同步成功后是否清理本地已不存在于云端的记录（默认 true）
    async syncFromCloud(pruneDeleted = true) {
        try {
            // 1) 拉取云端列表（新版 SDK 返回分页对象，需要迭代）
            const agentsPage = await client_1.lettaClient.agents.list();
            const cloudAgents = [];
            for await (const agent of agentsPage) {
                cloudAgents.push(agent);
            }
            // 2) 预先构建云端 id 集合（用于 prune）
            const cloudIdSet = new Set(cloudAgents.map(a => a.id));
            // 3) Upsert：逐个写入本地
            for (const agent of cloudAgents) {
                // 新版 SDK 使用 memory_blocks，兼容旧版 memoryBlocks
                const memoryBlocks = agent.memory_blocks || agent.memoryBlocks || [];
                const persona = memoryBlocks.find((b) => b.label === "persona")?.value ?? "";
                const human = memoryBlocks.find((b) => b.label === "human")?.value ?? "";
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
    async createRole(name, persona, human, voice, speed, pitch, style, avatarBase64) {
        // 新版 SDK 使用下划线格式的参数名
        const agent = await client_1.lettaClient.agents.create({
            name,
            memory_blocks: [
                { label: "persona", value: persona },
                { label: "human", value: human },
            ],
            model: "openai/gpt-4o-mini",
            embedding: "openai/text-embedding-3-small",
        });
        const id = (0, uuid_1.v4)();
        const createdAt = Date.now();
        // 如果提供了 avatar 的 base64 数据，则写入文件并保存文件名
        let avatarFileName = null;
        try {
            if (avatarBase64 && typeof avatarBase64 === "string") {
                const m = avatarBase64.match(/^data:(image\/(png|jpeg|jpg|gif));base64,(.+)$/);
                if (m) {
                    const mime = m[1];
                    const ext = m[2] === "jpeg" ? "jpg" : m[2];
                    const b64 = m[3];
                    const uploadsDir = process.env.AVATAR_DIR || path_1.default.resolve(process.cwd(), "uploads", "avatars");
                    await fs_1.default.promises.mkdir(uploadsDir, { recursive: true });
                    avatarFileName = `${(0, uuid_1.v4)()}.${ext}`;
                    const filePath = path_1.default.join(uploadsDir, avatarFileName);
                    await fs_1.default.promises.writeFile(filePath, Buffer.from(b64, "base64"));
                }
            }
        }
        catch (e) {
            console.warn("Failed to save avatar, continuing without avatar", e);
            avatarFileName = null;
        }
        await db_1.default.query("INSERT INTO agents (id, name, persona, human, agent_id, avatar, voice, speed, pitch, style, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)", [id, name, persona, human, agent.id, avatarFileName, voice || "ja-JP-MayuNeural", speed || 1.0, pitch || "15", style || "chat", createdAt]);
        return { id, name, persona, human, agentId: agent.id, avatar: avatarFileName, voice, speed, pitch, style, createdAt };
    },
    async listRoles() {
        const [rows] = await db_1.default.query("SELECT * FROM agents ORDER BY created_at DESC");
        return rows.map((row) => ({
            id: row.id,
            name: row.name,
            persona: row.persona,
            human: row.human,
            agentId: row.agent_id,
            avatar: row.avatar,
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
            avatar: row.avatar,
            voice: row.voice,
            speed: row.speed,
            pitch: row.pitch,
            style: row.style,
            createdAt: row.created_at,
        };
    },
    async updateRole(id, data) {
        // 读取当前记录
        const role = await this.getRole(id);
        if (!role)
            throw new Error('Role not found');
        // 处理 avatarBase64 替换（如果提供）
        let avatarFileName = role.avatar;
        try {
            if (data.avatarBase64 && typeof data.avatarBase64 === 'string') {
                const m = data.avatarBase64.match(/^data:(image\/(png|jpeg|jpg|gif));base64,(.+)$/);
                if (m) {
                    const ext = m[2] === 'jpeg' ? 'jpg' : m[2];
                    const b64 = m[3];
                    const uploadsDir = process.env.AVATAR_DIR || path_1.default.resolve(process.cwd(), 'uploads', 'avatars');
                    await fs_1.default.promises.mkdir(uploadsDir, { recursive: true });
                    const newFile = `${(0, uuid_1.v4)()}.${ext}`;
                    const filePath = path_1.default.join(uploadsDir, newFile);
                    await fs_1.default.promises.writeFile(filePath, Buffer.from(b64, 'base64'));
                    // 可选：删除旧文件
                    if (avatarFileName) {
                        try {
                            fs_1.default.unlinkSync(path_1.default.join(uploadsDir, avatarFileName));
                        }
                        catch { }
                    }
                    avatarFileName = newFile;
                }
            }
        }
        catch (e) {
            console.warn('Failed to save avatar during update, keeping old avatar', e);
        }
        const updates = [];
        const params = [];
        if (data.name !== undefined) {
            updates.push('name = ?');
            params.push(data.name);
        }
        if (data.persona !== undefined) {
            updates.push('persona = ?');
            params.push(data.persona);
        }
        if (data.human !== undefined) {
            updates.push('human = ?');
            params.push(data.human);
        }
        if (data.voice !== undefined) {
            updates.push('voice = ?');
            params.push(data.voice);
        }
        if (data.speed !== undefined) {
            updates.push('speed = ?');
            params.push(data.speed);
        }
        if (data.pitch !== undefined) {
            updates.push('pitch = ?');
            params.push(data.pitch);
        }
        if (data.style !== undefined) {
            updates.push('style = ?');
            params.push(data.style);
        }
        if (data.avatarBase64 !== undefined) {
            updates.push('avatar = ?');
            params.push(avatarFileName);
        }
        if (updates.length > 0) {
            params.push(id);
            await db_1.default.query(`UPDATE agents SET ${updates.join(', ')} WHERE id = ?`, params);
        }
        return await this.getRole(id);
    },
};
