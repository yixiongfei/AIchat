"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const message_service_1 = require("../letta/message.service");
const agent_service_1 = require("../letta/agent.service");
const router = (0, express_1.Router)();
/**
 * 发送消息（流式）
 * POST /api/messages/:roleId
 */
router.post("/:roleId", async (req, res) => {
    const { roleId } = req.params;
    const { message } = req.body;
    try {
        // 从数据库获取角色信息以获取 agentId
        const role = await agent_service_1.agentService.getRole(roleId);
        if (!role || !role.agentId) {
            return res.status(404).json({ error: "Role or Agent not found" });
        }
        await message_service_1.messageService.sendMessageStream(roleId, role.agentId, message, res);
    }
    catch (error) {
        console.error("Route error:", error);
        if (!res.headersSent) {
            res.status(500).json({ error: "Internal server error" });
        }
    }
});
exports.default = router;
