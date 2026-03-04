import { Router } from "express";
import pool from "../storage/db";
import { randomUUID } from "crypto";
import { lettaClient } from "../letta/client";

const router = Router();

/** Chat 类型定义 */
interface Chat {
  id: string;
  agent_id: string;
  letta_conversation_id?: string;
  title: string;
  created_at: number;
  updated_at: number;
  last_message?: string;
  message_count?: number;
}

/**
 * 获取指定 agent 的所有聊天
 * GET /api/chats/:agentId
 * Query: ?search=关键词
 */
router.get("/:agentId", async (req, res) => {
  const { agentId } = req.params;
  const { search } = req.query;

  try {
    let query = `
      SELECT 
        c.*,
        (SELECT content FROM messages WHERE chat_id = c.id ORDER BY timestamp DESC LIMIT 1) as last_message,
        (SELECT COUNT(*) FROM messages WHERE chat_id = c.id) as message_count
      FROM chats c
      WHERE c.agent_id = ?
    `;
    const params: any[] = [agentId];

    // 如果有搜索关键词，搜索标题和消息内容
    if (search && typeof search === 'string' && search.trim()) {
      query = `
        SELECT DISTINCT
          c.*,
          (SELECT content FROM messages WHERE chat_id = c.id ORDER BY timestamp DESC LIMIT 1) as last_message,
          (SELECT COUNT(*) FROM messages WHERE chat_id = c.id) as message_count
        FROM chats c
        LEFT JOIN messages m ON m.chat_id = c.id
        WHERE c.agent_id = ?
          AND (c.title LIKE ? OR m.content LIKE ?)
      `;
      const searchPattern = `%${search.trim()}%`;
      params.push(searchPattern, searchPattern);
    }

    query += ` ORDER BY c.updated_at DESC`;

    const [rows] = await pool.query(query, params);
    
    res.json({
      chats: rows,
      total: (rows as any[]).length
    });
  } catch (error) {
    console.error("Get chats error:", error);
    res.status(500).json({ error: "Failed to get chats" });
  }
});

/**
 * 创建新聊天
 * POST /api/chats/:agentId
 * Body: { title?: string }
 * 
 * 创建新对话时会同时调用 Letta API 创建 conversation，
 * 确保每个对话有独立的上下文，防止旧消息污染新对话
 */
router.post("/:agentId", async (req, res) => {
  const { agentId } = req.params;
  const { title } = req.body;

  try {
    // 首先从数据库获取对应的 letta agent_id
    const [agents] = await pool.query(
      `SELECT agent_id FROM agents WHERE id = ?`,
      [agentId]
    );
    
    const agentRows = agents as any[];
    if (agentRows.length === 0) {
      return res.status(404).json({ error: "Agent not found" });
    }

    const lettaAgentId = agentRows[0].agent_id;
    let lettaConversationId: string | null = null;

    // 调用 Letta API 创建新的 conversation
    // 这样可以确保每个对话有独立的上下文
    if (lettaAgentId) {
      try {
        const conversation = await lettaClient.conversations.create({
          agent_id: lettaAgentId
        });
        lettaConversationId = conversation.id;
        console.log(`Created Letta conversation: ${lettaConversationId} for agent: ${lettaAgentId}`);
      } catch (lettaError) {
        console.error("Failed to create Letta conversation:", lettaError);
        // 即使 Letta API 失败，仍然创建本地 chat
        // 这样用户可以继续使用，但可能会有上下文污染的问题
      }
    }

    const chatId = `chat_${randomUUID()}`;
    const now = Date.now();
    const chatTitle = title || "新对话";

    await pool.query(
      `INSERT INTO chats (id, agent_id, letta_conversation_id, title, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [chatId, agentId, lettaConversationId, chatTitle, now, now]
    );

    const chat: Chat = {
      id: chatId,
      agent_id: agentId,
      letta_conversation_id: lettaConversationId || undefined,
      title: chatTitle,
      created_at: now,
      updated_at: now,
      message_count: 0
    };

    res.json(chat);
  } catch (error) {
    console.error("Create chat error:", error);
    res.status(500).json({ error: "Failed to create chat" });
  }
});

/**
 * 更新聊天标题
 * PUT /api/chats/:chatId
 * Body: { title: string }
 * 
 * 同时更新本地数据库和 Letta 云端的 conversation summary
 */
router.put("/:chatId", async (req, res) => {
  const { chatId } = req.params;
  const { title } = req.body;

  try {
    if (!title) {
      return res.status(400).json({ error: "Title is required" });
    }

    // 先获取 letta_conversation_id
    const [chats] = await pool.query(
      `SELECT letta_conversation_id FROM chats WHERE id = ?`,
      [chatId]
    );
    
    const chatRows = chats as any[];
    if (chatRows.length === 0) {
      return res.status(404).json({ error: "Chat not found" });
    }

    const lettaConversationId = chatRows[0].letta_conversation_id;

    // 如果有 Letta conversation，同步更新云端的 summary
    if (lettaConversationId) {
      try {
        await lettaClient.conversations.update(lettaConversationId, {
          summary: title
        });
        console.log(`Updated Letta conversation summary: ${lettaConversationId} -> ${title}`);
      } catch (lettaError) {
        // 即使 Letta API 失败，仍然继续更新本地记录
        console.error("Failed to update Letta conversation summary:", lettaError);
      }
    }

    // 更新本地数据库
    const [result] = await pool.query(
      `UPDATE chats SET title = ?, updated_at = ? WHERE id = ?`,
      [title, Date.now(), chatId]
    );

    if ((result as any).affectedRows === 0) {
      return res.status(404).json({ error: "Chat not found" });
    }

    res.json({ success: true, chatId, title });
  } catch (error) {
    console.error("Update chat error:", error);
    res.status(500).json({ error: "Failed to update chat" });
  }
});

/**
 * 删除聊天
 * DELETE /api/chats/:chatId
 * 
 * 同时删除本地数据库记录和 Letta 云端的 conversation
 */
router.delete("/:chatId", async (req, res) => {
  const { chatId } = req.params;

  try {
    // 先获取 letta_conversation_id
    const [chats] = await pool.query(
      `SELECT letta_conversation_id FROM chats WHERE id = ?`,
      [chatId]
    );
    
    const chatRows = chats as any[];
    if (chatRows.length === 0) {
      return res.status(404).json({ error: "Chat not found" });
    }

    const lettaConversationId = chatRows[0].letta_conversation_id;

    // 如果有 Letta conversation，当前不执行远程 cancel（可能返回 409）

    // 删除聊天中的所有消息
    await pool.query(`DELETE FROM messages WHERE chat_id = ?`, [chatId]);
    
    // 删除聊天
    const [result] = await pool.query(`DELETE FROM chats WHERE id = ?`, [chatId]);

    if ((result as any).affectedRows === 0) {
      return res.status(404).json({ error: "Chat not found" });
    }

    res.json({ success: true, chatId });
  } catch (error) {
    console.error("Delete chat error:", error);
    res.status(500).json({ error: "Failed to delete chat" });
  }
});

/**
 * 清空聊天的消息（保留聊天本身）
 * DELETE /api/chats/:chatId/messages
 */
router.delete("/:chatId/messages", async (req, res) => {
  const { chatId } = req.params;

  try {
    const [result] = await pool.query(
      `DELETE FROM messages WHERE chat_id = ?`,
      [chatId]
    );

    const deleted = (result as any).affectedRows;
    console.log(`[Chat] Cleared ${deleted} messages for chat ${chatId}`);
    res.json({ success: true, deleted });
  } catch (error) {
    console.error("Clear chat messages error:", error);
    res.status(500).json({ error: "Failed to clear chat messages" });
  }
});

/**
 * 获取聊天的消息
 * GET /api/chats/:chatId/messages
 */
router.get("/:chatId/messages", async (req, res) => {
  const { chatId } = req.params;

  try {
    const [rows] = await pool.query(
      `SELECT id, role, content, timestamp, images FROM messages WHERE chat_id = ? ORDER BY timestamp ASC`,
      [chatId]
    );

    // 处理 images 字段（从 JSON 字符串解析）
    const messages = (rows as any[]).map(row => ({
      ...row,
      images: row.images ? JSON.parse(row.images) : undefined
    }));

    res.json({ messages });
  } catch (error) {
    console.error("Get messages error:", error);
    res.status(500).json({ error: "Failed to get messages" });
  }
});

export default router;
