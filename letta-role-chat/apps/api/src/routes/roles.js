"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const agent_service_1 = require("../letta/agent.service");
const message_service_1 = require("../letta/message.service");
const router = (0, express_1.Router)();
// 获取所有角色
router.get("/", async (req, res) => {
    try {
        const roles = await agent_service_1.agentService.listRoles();
        res.json(roles);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to list roles" });
    }
});
// 创建新角色
router.post("/", async (req, res) => {
    try {
        const { name, persona, human, voice, speed, pitch, style } = req.body;
        const role = await agent_service_1.agentService.createRole(name, persona, human, voice, speed, pitch, style);
        res.status(201).json(role);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to create role" });
    }
});
// 从 Letta Cloud 同步角色
router.post("/sync", async (req, res) => {
    try {
        const result = await agent_service_1.agentService.syncFromCloud();
        res.json(result);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to sync roles" });
    }
});
// 获取特定角色的历史消息
router.get("/:roleId/history", async (req, res) => {
    try {
        const { roleId } = req.params;
        const history = await message_service_1.messageService.getHistory(roleId);
        res.json(history);
    }
    catch (error) {
        res.status(500).json({ error: "Failed to fetch history" });
    }
});
exports.default = router;
