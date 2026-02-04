import { Response } from "express";
import pool from "../storage/db";
import { v4 as uuidv4 } from "uuid";
import "dotenv/config";
import { lettaClient } from "./client";

function normalizeBaseUrl(url: string) {
  return url.replace(/\/$/, "");
}

// 将用户输入用不可混淆的边界包起来，防止提示词注入
function wrapUserInput(input: string) {
  const start = "<<<USER_INPUT_START>>>";
  const end = "<<<USER_INPUT_END>>>";
  return `${start}\n${input}\n${end}`;
}

// ✅ 从 base64 data URI 中解析出 mediaType 和纯 base64 数据
function parseBase64Image(dataUri: string): { mediaType: string; data: string } | null {
  // 格式: data:image/png;base64,iVBORw0KGgo...
  const match = dataUri.match(/^data:(image\/\w+);base64,(.+)$/);
  if (match) {
    return { mediaType: match[1], data: match[2] };
  }
  // 如果已经是纯 base64（没有前缀），默认当 jpeg
  if (!dataUri.startsWith('data:') && !dataUri.startsWith('http')) {
    return { mediaType: 'image/jpeg', data: dataUri };
  }
  return null;
}

// ✅ 构建 Letta 官方多模态消息格式
function buildMessageContent(text: string, images?: string[]) {
  // 如果没有图片，返回包装后的纯文本
  if (!images || images.length === 0) {
    return wrapUserInput(text);
  }

  // 有图片时，构建 Letta 官方多模态内容数组
  const content: Array<any> = [];

  // 添加文本部分
  if (text) {
    content.push({
      type: "text",
      text: wrapUserInput(text)
    });
  }

  // 添加图片部分（Letta 官方格式）
  for (const img of images) {
    const parsed = parseBase64Image(img);
    if (parsed) {
      content.push({
        type: "image",
        source: {
          type: "base64",
          mediaType: parsed.mediaType,  // ✅ 使用 camelCase（Letta SDK 要求）
          data: parsed.data
        }
      });
    }
  }

  return content;
}

// ✅ 延时函数
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ✅ 从 Run 结果中提取 assistant 消息内容
function extractAssistantContent(run: any): string {
  if (!run.messages || !Array.isArray(run.messages)) {
    return "";
  }
  
  // 过滤出 assistant 消息并合并内容
  const assistantMessages = run.messages.filter((msg: any) => 
    msg.role === "assistant" || msg.message_type === "assistant_message"
  );
  
  return assistantMessages
    .map((msg: any) => {
      // 尝试多种可能的内容字段
      if (typeof msg.content === "string") return msg.content;
      if (msg.assistant_message) return msg.assistant_message;
      if (msg.text) return msg.text;
      return "";
    })
    .filter(Boolean)
    .join("");
}

/**
 * ========================================
 * 消息发送策略配置
 * ========================================
 * 
 * 策略说明：
 * 1. **同步流式 (createStream)** - 适用于：
 *    - 纯文本消息（无图片）
 *    - 需要快速响应和逐字显示的场景
 *    - 优点：低延迟，真正的 token-by-token 流式
 *    - 缺点：不支持 background 处理（可能阻塞）
 * 
 * 2. **异步轮询 (createAsync)** - 适用于：
 *    - 带图片的多模态消息
 *    - 复杂/耗时的任务（如代码生成、长文本分析）
 *    - 需要后台处理的场景
 *    - 优点：不阻塞，支持超时和取消
 *    - 缺点：轮询开销，响应延迟较高
 */
interface MessageStrategyConfig {
  // 图片消息强制使用异步（多模态处理可能较慢）
  forceAsyncForImages: boolean;
  // 长文本阈值（超过此字符数使用异步）
  longTextThreshold: number;
  // 同步流式是否启用 token 级别流式
  streamTokens: boolean;
  // 同步流式是否启用 ping 保活
  includePings: boolean;
  // 异步轮询间隔（毫秒）
  asyncPollInterval: number;
  // 异步最大等待时间（毫秒）
  asyncMaxWaitTime: number;
}

const DEFAULT_STRATEGY: MessageStrategyConfig = {
  forceAsyncForImages: true,       // 图片消息使用异步
  longTextThreshold: 5000,         // 5000 字符以上使用异步
  streamTokens: true,              // 启用 token 流式
  includePings: true,              // 启用 ping 保活
  asyncPollInterval: 500,          // 500ms 轮询
  asyncMaxWaitTime: 5 * 60 * 1000, // 5 分钟超时
};

/**
 * 决定使用哪种消息发送策略
 */
function chooseStrategy(text: string, images?: string[], config = DEFAULT_STRATEGY): "stream" | "async" {
  // 1. 有图片 -> 异步
  if (config.forceAsyncForImages && images && images.length > 0) {
    console.log("[Strategy] Using ASYNC: message contains images");
    return "async";
  }
  
  // 2. 长文本 -> 异步
  if (text.length > config.longTextThreshold) {
    console.log(`[Strategy] Using ASYNC: text length ${text.length} > ${config.longTextThreshold}`);
    return "async";
  }
  
  // 3. 默认使用同步流式（更快的响应）
  console.log("[Strategy] Using STREAM: default for short text without images");
  return "stream";
}

export const messageService = {
  /**
   * 智能消息发送（自动选择最优策略）
   */
  async sendMessageStream(roleId: string, agentId: string, text: string, res: Response, images?: string[]) {
    const strategy = chooseStrategy(text, images);
    
    if (strategy === "stream") {
      return this.sendMessageStreamSync(roleId, agentId, text, res);
    } else {
      return this.sendMessageAsync(roleId, agentId, text, res, images);
    }
  },

  /**
   * ========================================
   * 方式一：同步流式 (createStream)
   * ========================================
   * 真正的 token-by-token 流式响应，延迟最低
   */
  async sendMessageStreamSync(roleId: string, agentId: string, text: string, res: Response) {
    // SSE headers
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    // 1. 保存用户消息到数据库
    const userMsgId = uuidv4();
    await pool.query(
      'INSERT INTO messages (id, agent_id, role, content, timestamp, images) VALUES (?, ?, ?, ?, ?, ?)',
      [userMsgId, roleId, 'user', text, Date.now(), null]
    );

    let assistantContent = "";

    try {
      console.log(`[Stream] Starting streaming for agent ${agentId}...`);

      // ✅ 使用同步流式 API
      const stream = await lettaClient.agents.messages.createStream(agentId, {
        messages: [{ role: "user", content: wrapUserInput(text) }],
        streamTokens: DEFAULT_STRATEGY.streamTokens,
        includePings: DEFAULT_STRATEGY.includePings,
        useAssistantMessage: true,
      });

      // 通知前端开始流式
      res.write(`data: ${JSON.stringify({ type: "stream_started" })}\n\n`);

      // ✅ 处理流式响应
      for await (const chunk of stream) {
        // 跳过 ping 消息
        if (chunk.messageType === "ping") {
          continue;
        }

        // 处理停止原因
        if (chunk.messageType === "stop_reason") {
          console.log(`[Stream] Stop reason: ${(chunk as any).stopReason}`);
          continue;
        }

        // 处理使用统计
        if (chunk.messageType === "usage_statistics") {
          console.log(`[Stream] Usage:`, chunk);
          continue;
        }

        // ✅ 处理 assistant 消息
        if (chunk.messageType === "assistant_message") {
          let content = "";
          
          if (typeof chunk.content === "string") {
            content = chunk.content;
          } else if (Array.isArray(chunk.content)) {
            content = chunk.content
              .filter((part: any) => part.type === "text")
              .map((part: any) => part.text)
              .join("");
          }

          if (content) {
            assistantContent += content;
            // 以 SSE 格式发送内容
            res.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
          }
        }

        // 处理工具调用消息（可选：通知前端正在思考）
        if (chunk.messageType === "tool_call_message") {
          res.write(`data: ${JSON.stringify({ type: "thinking", tool: (chunk as any).toolCall?.name })}\n\n`);
        }
      }

      console.log(`[Stream] Completed, content length: ${assistantContent.length}`);

    } catch (error: any) {
      console.error("[Stream] Error:", error);
      res.write(`data: ${JSON.stringify({ error: "Stream error", detail: error.message })}\n\n`);
    }

    // 2. 保存助手回复到数据库
    if (assistantContent) {
      const assistantMsgId = uuidv4();
      await pool.query(
        'INSERT INTO messages (id, agent_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?)',
        [assistantMsgId, roleId, 'assistant', assistantContent, Date.now()]
      );
    }

    // 发送完成标记
    res.write(`data: [DONE]\n\n`);
    res.end();
  },

  /**
   * ========================================
   * 方式二：异步轮询 (createAsync)
   * ========================================
   * 适用于多模态消息和复杂任务
   */
  async sendMessageAsync(roleId: string, agentId: string, text: string, res: Response, images?: string[]) {
    // SSE headers
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    // 1. 保存用户消息到数据库（包含图片信息）
    const userMsgId = uuidv4();
    const imagesJson = images && images.length > 0 ? JSON.stringify(images) : null;
    await pool.query(
      'INSERT INTO messages (id, agent_id, role, content, timestamp, images) VALUES (?, ?, ?, ?, ?, ?)',
      [userMsgId, roleId, 'user', text, Date.now(), imagesJson]
    );

    try {
      // ✅ 构建 Letta 官方多模态消息内容
      const messageContent = buildMessageContent(text, images);

      // ✅ 使用异步 API 创建后台任务
      console.log(`[Async] Creating async message for agent ${agentId}...`);
      
      const run = await lettaClient.agents.messages.createAsync(agentId, {
        messages: [{ role: "user", content: messageContent }],
      });

      const runId = run.id;
      if (!runId) {
        res.write(`data: ${JSON.stringify({ error: "Failed to create async run" })}\n\n`);
        return res.end();
      }
      console.log(`[Async] Run created: ${runId}, status: ${run.status}`);

      // ✅ 发送初始状态
      res.write(`data: ${JSON.stringify({ type: "run_started", runId, status: run.status })}\n\n`);

      // ✅ 轮询检查运行状态
      let assistantContent = "";
      let lastStatus = run.status;
      const { asyncMaxWaitTime, asyncPollInterval } = DEFAULT_STRATEGY;
      const startTime = Date.now();

      while (true) {
        // 检查超时
        if (Date.now() - startTime > asyncMaxWaitTime) {
          res.write(`data: ${JSON.stringify({ error: "Timeout waiting for response" })}\n\n`);
          break;
        }

        // 等待后轮询
        await sleep(asyncPollInterval);

        // 获取运行状态
        const currentRun = await lettaClient.runs.retrieve(runId);
        
        // 状态变化时通知前端
        if (currentRun.status !== lastStatus) {
          console.log(`[Async] Run ${runId} status: ${lastStatus} -> ${currentRun.status}`);
          lastStatus = currentRun.status;
          res.write(`data: ${JSON.stringify({ type: "status_update", status: currentRun.status })}\n\n`);
        }

        // 检查是否完成
        if (currentRun.status === "completed") {
          // ✅ 获取完整的运行结果（包含消息）
          const messages = await lettaClient.runs.messages.list(runId);
          
          // 提取 assistant 消息（LettaMessageUnion 使用 messageType 而非 role）
          for (const msg of messages) {
            // 检查是否是 AssistantMessage 类型
            if (msg.messageType === "assistant_message") {
              let content = "";
              // AssistantMessage.content 可能是 string 或 content parts 数组
              if (typeof msg.content === "string") {
                content = msg.content;
              } else if (Array.isArray(msg.content)) {
                // 如果是数组，提取文本部分
                content = msg.content
                  .filter((part: any) => part.type === "text")
                  .map((part: any) => part.text)
                  .join("");
              }
              
              if (content) {
                assistantContent += content;
                // 以 SSE 格式发送内容（模拟流式）
                res.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
              }
            }
          }
          
          console.log(`[Async] Run ${runId} completed, content length: ${assistantContent.length}`);
          break;
        }

        // 检查是否失败
        if (currentRun.status === "failed" || currentRun.status === "cancelled") {
          const errorMsg = (currentRun as any).callback_error || `Run ${currentRun.status}`;
          console.error(`[Async] Run ${runId} failed:`, errorMsg);
          res.write(`data: ${JSON.stringify({ error: errorMsg })}\n\n`);
          break;
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

      // 发送完成标记
      res.write(`data: [DONE]\n\n`);
      res.end();
    } catch (error: any) {
      console.error("[Async] Error:", error);
      res.write(`data: ${JSON.stringify({ error: "Failed to process message", detail: error.message })}\n\n`);
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
      timestamp: row.timestamp,
      images: row.images ? JSON.parse(row.images) : undefined
    }));
  },

  async deleteHistory(agentId: string) {
    try {
      const [result]: any = await pool.query('DELETE FROM messages WHERE agent_id = ?', [agentId]);
      const deleted = result?.affectedRows ?? result?.affected ?? 0;
      console.log(`[Message] Deleted ${deleted} messages for agent ${agentId}`);
      return { success: true, deleted };
    } catch (e) {
      console.error("Failed to delete history:", e);
      throw e;
    }
  }
};
