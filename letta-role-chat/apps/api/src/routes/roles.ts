import { Router } from "express";
import { agentService } from "../letta/agent.service";
import { messageService } from "../letta/message.service";

const router = Router();

// 获取所有角色
router.get("/", async (req, res) => {
  try {
    const roles = await agentService.listRoles();
    res.json(roles);
  } catch (error) {
    res.status(500).json({ error: "Failed to list roles" });
  }
});

// 创建新角色
router.post("/", async (req, res) => {
  try {
    const { name, persona, human } = req.body;
    const role = await agentService.createRole(name, persona, human);
    res.status(201).json(role);
  } catch (error) {
    res.status(500).json({ error: "Failed to create role" });
  }
});

// 从 Letta Cloud 同步角色
router.post("/sync", async (req, res) => {
  try {
    const result = await agentService.syncFromCloud();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: "Failed to sync roles" });
  }
});

// 获取特定角色的历史消息
router.get("/:roleId/history", async (req, res) => {
  try {
    const { roleId } = req.params;
    const history = await messageService.getHistory(roleId);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

export default router;
