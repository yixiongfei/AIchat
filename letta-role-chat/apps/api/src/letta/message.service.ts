import { Response } from "express";
import pool from "../storage/db";
import { v4 as uuidv4 } from "uuid";
import "dotenv/config";

function normalizeBaseUrl(url: string) {
  return url.replace(/\/$/, "");
}

// 将用户输入用不可混淆的边界包起来，防止提示词注入
function wrapUserInput(input: string) {
  const start = "<<<USER_INPUT_START>>>";
  const end = "<<<USER_INPUT_END>>>";
  return `${start}\n${input}\n${end}`;
}

export const messageService = {
  async sendMessageStream(roleId: string, agentId: string, text: string, res: Response) {
    // SSE headers
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    // 1. 保存用户消息到数据库
    const userMsgId = uuidv4();
    await pool.query(
      'INSERT INTO messages (id, agent_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)',
      [userMsgId, roleId, 'user', text, Date.now()]
    );

    try {
      const baseUrl = normalizeBaseUrl(process.env.LETTA_BASE_URL || "https://api.letta.com");
      const apiKey = process.env.LETTA_API_KEY;

      const url = `${baseUrl}/v1/agents/${agentId}/messages/stream`;

      // 给 Letta 的请求使用包装后的用户输入（数据库仍保存原始文本）
      const wrapped = wrapUserInput(text);

      const upstream = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: wrapped }],
          stream_tokens: true,
        }),
      });

      if (!upstream.ok || !upstream.body) {
        const errText = await upstream.text().catch(() => "");
        res.write(`data: ${JSON.stringify({ error: "Upstream error", detail: errText })}\n\n`);
        return res.end();
      }

      const reader = upstream.body.getReader();
      const decoder = new TextDecoder();
      let assistantContent = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        res.write(chunk);

        // 尝试解析内容以保存到数据库
        const lines = chunk.split('\n');
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              // 根据 Letta SSE 格式提取内容，这里假设是 token 级流式
              if (data.choices?.[0]?.delta?.content) {
                assistantContent += data.choices[0].delta.content;
              } else if (data.content) {
                assistantContent += data.content;
              }
            } catch (e) {
              // 忽略非 JSON 行
            }
          }
        }
      }

      // 2. 保存助手回复到数据库
      if (assistantContent) {
        const assistantMsgId = uuidv4();
        await pool.query(
          'INSERT INTO messages (id, agent_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)',
          [assistantMsgId, roleId, 'assistant', assistantContent, Date.now()]
        );
      }

      res.end();
    } catch (error: any) {
      console.error("Streaming error:", error);
      res.write(`data: ${JSON.stringify({ error: "Failed to fetch stream" })}\n\n`);
      res.end();
    }
  },

  async getHistory(roleId: string) {
    const [rows]: any = await pool.query(
      'SELECT * FROM messages WHERE agent_id = ? ORDER BY timestamp ASC',
      [roleId]
    );
    return rows.map((row: any) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      timestamp: row.timestamp
    }));
  }
  ,
  async deleteHistory(agentId: string) {
    try {
      const [result]: any = await pool.query('DELETE FROM messages WHERE agent_id = ?', [agentId]);
      // result.affectedRows or result.affected may vary by driver
      const deleted = result?.affectedRows ?? result?.affected ?? 0;
      console.log(`[Message] Deleted ${deleted} messages for agent ${agentId}`);
      return { success: true, deleted };
    } catch (e) {
      console.error("Failed to delete history:", e);
      throw e;
    }
  }
};
