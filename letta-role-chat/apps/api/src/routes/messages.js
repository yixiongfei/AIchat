"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const message_service_1 = require("../letta/message.service");
const agent_service_1 = require("../letta/agent.service");
const router = (0, express_1.Router)();
/**
 * 发送消息（流式）
 * POST /api/messages/:roleId
 * Body: { message: string, images?: string[], attachments?: AttachmentInfo[], chatId?: string }
 */
router.post("/:roleId", async (req, res) => {
    const { roleId } = req.params;
    const { message, images, attachments, chatId } = req.body;
    try {
        // 从数据库获取角色信息以获取 agentId
        const role = await agent_service_1.agentService.getRole(roleId);
        if (!role || !role.agentId) {
            return res.status(404).json({ error: "Role or Agent not found" });
        }
        // 构建完整消息：如果有附件，将内容拼接进消息
        let fullMessage = message;
        if (attachments && attachments.length > 0) {
            const attachmentContents = attachments.map((att) => `\n\n--- 附件: ${att.fileName} (${att.lineCount} 行, ${att.charCount} 字符) ---\n${att.content}\n--- 附件结束 ---`);
            fullMessage = fullMessage
                ? `${fullMessage}\n${attachmentContents.join('\n')}`
                : attachmentContents.join('\n');
        }
        await message_service_1.messageService.sendMessageStream(roleId, role.agentId, fullMessage, res, images, chatId);
    }
    catch (error) {
        console.error("Route error:", error);
        if (!res.headersSent) {
            res.status(500).json({ error: "Internal server error" });
        }
    }
});
// 删除指定角色的所有消息
router.delete('/:roleId', async (req, res) => {
    const { roleId } = req.params;
    try {
        const role = await agent_service_1.agentService.getRole(roleId);
        if (!role)
            return res.status(404).json({ error: 'Role not found' });
        const result = await message_service_1.messageService.deleteHistory(roleId);
        res.json(result);
    }
    catch (error) {
        console.error('Delete history error:', error);
        res.status(500).json({ error: 'Failed to delete history' });
    }
});
exports.default = router;
