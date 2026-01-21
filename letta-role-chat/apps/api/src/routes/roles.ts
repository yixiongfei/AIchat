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
    const { name, persona, human, voice, speed, pitch, style, avatarBase64 } = req.body;
    const role = await agentService.createRole(name, persona, human, voice, speed, pitch, style, avatarBase64);
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

// 更新角色
router.put('/:roleId', async (req, res) => {
  const { roleId } = req.params;
  const { name, persona, human, voice, speed, pitch, style, avatarBase64 } = req.body;
  try {
    const updated = await agentService.updateRole(roleId, { name, persona, human, voice, speed, pitch, style, avatarBase64 });
    res.json(updated);
  } catch (error: any) {
    console.error('Update role error:', error);
    res.status(500).json({ error: error?.message || 'Failed to update role' });
  }
});

export default router;
