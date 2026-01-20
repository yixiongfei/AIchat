import { Router } from "express";
import { messageService } from "../letta/message.service";
import { agentService } from "../letta/agent.service";

const router = Router();

/**
 * 发送消息（流式）
 * POST /api/messages/:roleId
 */
router.post("/:roleId", async (req, res) => {
  const { roleId } = req.params;
  const { message } = req.body;

  try {
    // 从数据库获取角色信息以获取 agentId
    const role = await agentService.getRole(roleId);
    if (!role || !role.agentId) {
      return res.status(404).json({ error: "Role or Agent not found" });
    }

    await messageService.sendMessageStream(roleId, role.agentId, message, res);
  } catch (error) {
    console.error("Route error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: "Internal server error" });
    }
  }
});

export default router;
