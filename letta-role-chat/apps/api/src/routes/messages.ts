import { Router } from "express";
import { messageService } from "../letta/message.service";
import { agentService } from "../letta/agent.service";

const router = Router();

/** 附件信息接口（前端直接发送内容） */
interface AttachmentInfo {
  fileName: string;
  content: string;
  charCount: number;
  lineCount: number;
}

/**
 * 发送消息（流式）
 * POST /api/messages/:roleId
 * Body: { message: string, images?: string[], attachments?: AttachmentInfo[], chatId?: string }
 */
router.post("/:roleId", async (req, res) => {
  const { roleId } = req.params;
  const { message, images, attachments, chatId } = req.body as {
    message: string;
    images?: string[];
    attachments?: AttachmentInfo[];
    chatId?: string;
  };

  try {
    // 从数据库获取角色信息以获取 agentId
    const role = await agentService.getRole(roleId);
    if (!role || !role.agentId) {
      return res.status(404).json({ error: "Role or Agent not found" });
    }

    // 构建完整消息：如果有附件，将内容拼接进消息
    let fullMessage = message;
    
    if (attachments && attachments.length > 0) {
      const attachmentContents = attachments.map((att) =>
        `\n\n--- 附件: ${att.fileName} (${att.lineCount} 行, ${att.charCount} 字符) ---\n${att.content}\n--- 附件结束 ---`
      );
      
      fullMessage = fullMessage 
        ? `${fullMessage}\n${attachmentContents.join('\n')}`
        : attachmentContents.join('\n');
    }

    await messageService.sendMessageStream(roleId, role.agentId, fullMessage, res, images, chatId);
  } catch (error) {
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
    const role = await agentService.getRole(roleId);
    if (!role) return res.status(404).json({ error: 'Role not found' });

    const result = await messageService.deleteHistory(roleId);
    res.json(result);
  } catch (error) {
    console.error('Delete history error:', error);
    res.status(500).json({ error: 'Failed to delete history' });
  }
});

// 删除单条消息
router.delete('/message/:messageId', async (req, res) => {
  const { messageId } = req.params;
  try {
    const result = await messageService.deleteMessage(messageId);
    if (result.success) {
      res.json(result);
    } else {
      res.status(404).json({ error: 'Message not found' });
    }
  } catch (error) {
    console.error('Delete message error:', error);
    res.status(500).json({ error: 'Failed to delete message' });
  }
});

export default router;