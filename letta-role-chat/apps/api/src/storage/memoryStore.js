"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.store = void 0;
// apps/api/src/storage/memoryStore.ts
const crypto_1 = require("crypto");
function nowISO() {
    return new Date().toISOString();
}
function safeId(prefix = "role") {
    try {
        return `${prefix}_${(0, crypto_1.randomUUID)()}`;
    }
    catch {
        // 极端情况下 crypto 不可用时的 fallback（不建议生产使用）
        return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now()}`;
    }
}
class MemoryStore {
    constructor() {
        // roleId -> role
        this.roles = new Map();
        // roleId -> conversations[]
        this.conversations = new Map();
    }
    /**
     * 创建角色（只负责存你的角色信息，不负责创建 agent）
     * agentId 通常由 agentService 创建后回填 updateRole
     */
    createRole(input) {
        const id = safeId("role");
        const t = nowISO();
        const role = {
            id,
            name: input.name,
            persona: input.persona,
            human: input.human,
            createdAt: t,
            updatedAt: t,
            conversationIds: [],
        };
        this.roles.set(id, role);
        this.conversations.set(id, []);
        return role;
    }
    listRoles() {
        return Array.from(this.roles.values());
    }
    getRole(roleId) {
        return this.roles.get(roleId);
    }
    /**
     * 更新角色：你现在路由需要的 updateRole(roleId, { conversationId })
     */
    updateRole(roleId, patch) {
        const role = this.roles.get(roleId);
        if (!role)
            return undefined;
        const updated = {
            ...role,
            ...patch,
            updatedAt: nowISO(),
        };
        // 如果设置了 conversationId，顺便把它加入 conversationIds（如果启用多会话）
        if (patch.conversationId) {
            const ids = new Set(updated.conversationIds ?? []);
            ids.add(patch.conversationId);
            updated.conversationIds = Array.from(ids);
        }
        this.roles.set(roleId, updated);
        return updated;
    }
    /**
     * 删除角色（开发期可选）
     */
    deleteRole(roleId) {
        this.conversations.delete(roleId);
        return this.roles.delete(roleId);
    }
    /**
     * 添加会话（用于“一角色多会话”）
     * - conversationId: Letta conversation id
     * - name: 可选名字
     */
    addConversation(roleId, input) {
        const role = this.roles.get(roleId);
        if (!role) {
            throw new Error(`Role not found: ${roleId}`);
        }
        const list = this.conversations.get(roleId) ?? [];
        const exists = list.find((c) => c.conversationId === input.conversationId);
        if (exists)
            return exists;
        const conv = {
            id: safeId("conv"),
            roleId,
            conversationId: input.conversationId,
            name: input.name,
            createdAt: nowISO(),
        };
        list.push(conv);
        this.conversations.set(roleId, list);
        // 同步到 role.conversationIds
        this.updateRole(roleId, {
            conversationIds: Array.from(new Set([...(role.conversationIds ?? []), input.conversationId])),
        });
        return conv;
    }
    listConversations(roleId) {
        return this.conversations.get(roleId) ?? [];
    }
    /**
     * 获取默认会话：如果 role.conversationId 没有，就返回最近一个 conversationId（若有）
     */
    getDefaultConversationId(roleId) {
        const role = this.roles.get(roleId);
        if (!role)
            return undefined;
        if (role.conversationId)
            return role.conversationId;
        const list = this.conversations.get(roleId) ?? [];
        const last = list[list.length - 1];
        return last?.conversationId;
    }
    /**
     * 设置默认会话（你当前的路由会用到）
     */
    setDefaultConversationId(roleId, conversationId) {
        // 同时也加入 conversationIds
        return this.updateRole(roleId, { conversationId });
    }
    /**
     * 清空所有数据（开发期调试方便）
     */
    reset() {
        this.roles.clear();
        this.conversations.clear();
    }
}
exports.store = new MemoryStore();
