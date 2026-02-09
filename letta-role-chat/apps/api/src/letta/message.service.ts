import { Response } from "express";
import pool from "../storage/db";
import { v4 as uuidv4 } from "uuid";
import "dotenv/config";
import { lettaClient } from "./client";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import type { MessageRow, DeleteResult } from "../storage/types";

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

// ✅ 构建 Letta 消息内容（支持多模态）
// Letta SDK 的 input 参数支持：
// - string: 纯文本
// - Array<TextContent | ImageContent | ...>: 多模态内容数组
type LettaTextContent = { type: "text"; text: string };
type LettaImageContent = { 
  type: "image"; 
  source: { 
    type: "base64"; 
    data: string; 
    media_type: string;  // 注意：Letta 使用下划线格式 media_type
  } 
};
type LettaMessageContent = string | Array<LettaTextContent | LettaImageContent>;

function buildMessageContent(text: string, images?: string[]): LettaMessageContent {
  // 如果没有图片，返回包装后的纯文本
  if (!images || images.length === 0) {
    return wrapUserInput(text);
  }

  // 有图片时，构建 Letta 官方多模态内容数组
  const content: Array<LettaTextContent | LettaImageContent> = [];

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
          media_type: parsed.mediaType,  // ✅ Letta SDK 使用下划线格式 media_type
          data: parsed.data
        }
      });
    }
  }

  console.log(`[buildMessageContent] Built multimodal content with ${content.length} parts (text: ${text ? 1 : 0}, images: ${images.length})`);
  return content;
}

// ✅ 延时函数
function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ✅ 判断是否为可重试的瞬态网络错误
function isTransientError(error: any): boolean {
  const code = error?.cause?.code || error?.code;
  const transientCodes = ['ECONNRESET', 'ETIMEDOUT', 'ECONNREFUSED', 'EPIPE', 'EAI_AGAIN'];
  if (transientCodes.includes(code)) return true;
  // fetch failed 通常是网络层错误
  if (error?.cause?.message?.includes('fetch failed')) return true;
  if (error?.message?.includes('Connection error')) return true;
  return false;
}

// ✅ 带指数退避的重试包装器（用于流式/异步 API 调用）
async function retryOnTransientError<T>(
  fn: () => Promise<T>,
  label: string,
  maxRetries = 3,
  baseDelay = 1000,
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: any) {
      lastError = error;
      if (attempt < maxRetries && isTransientError(error)) {
        const delay = baseDelay * Math.pow(2, attempt); // 1s, 2s, 4s
        console.warn(`[${label}] Transient error (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`, error.message);
        await sleep(delay);
        continue;
      }
      throw error;
    }
  }
  throw lastError;
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

/**
 * 从 chatId 获取 Letta conversation_id
 */
async function getLettaConversationId(chatId?: string): Promise<string | null> {
  if (!chatId) return null;
  
  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      'SELECT letta_conversation_id FROM chats WHERE id = ?',
      [chatId]
    );
    return rows.length > 0 ? rows[0].letta_conversation_id : null;
  } catch (error) {
    console.error("[getLettaConversationId] Error:", error);
    return null;
  }
}

export const messageService = {
  /**
   * 智能消息发送（自动选择最优策略）
   */
  async sendMessageStream(roleId: string, agentId: string, text: string, res: Response, images?: string[], chatId?: string) {
    const strategy = chooseStrategy(text, images);
    
    if (strategy === "stream") {
      return this.sendMessageStreamSync(roleId, agentId, text, res, chatId);
    } else {
      return this.sendMessageAsync(roleId, agentId, text, res, images, chatId);
    }
  },

  /**
   * ========================================
   * 方式一：同步流式 (streaming=true)
   * ========================================
   * 真正的 token-by-token 流式响应，延迟最低
   * 新版 SDK (v1.x) 使用 streaming: true 参数
   */
  async sendMessageStreamSync(roleId: string, agentId: string, text: string, res: Response, chatId?: string) {
    // SSE headers
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    // 获取 Letta conversation_id（如果有）
    const lettaConversationId = await getLettaConversationId(chatId);

    // 1. 保存用户消息到数据库
    const userMsgId = uuidv4();
    await pool.query(
      'INSERT INTO messages (id, agent_id, chat_id, role, content, timestamp, images) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userMsgId, roleId, chatId || null, 'user', text, Date.now(), null]
    );
    
    // 更新 chat 的 updated_at
    if (chatId) {
      await pool.query('UPDATE chats SET updated_at = ? WHERE id = ?', [Date.now(), chatId]);
    }

    let assistantContent = "";

    try {

      // ✅ 根据是否有 conversation_id 选择不同的 API（带重试）
      const stream = await retryOnTransientError(async () => {
        if (lettaConversationId) {
          // 使用 conversation 专用 API，确保消息隔离
          return await lettaClient.conversations.messages.create(lettaConversationId, {
            input: wrapUserInput(text),
            stream_tokens: DEFAULT_STRATEGY.streamTokens,
            include_pings: DEFAULT_STRATEGY.includePings,
            streaming: true,  // ✅ 添加 streaming: true，否则不会返回流式响应
          });
        } else {
          // 使用传统的 agent API（向后兼容）
          return await lettaClient.agents.messages.create(agentId, {
            input: wrapUserInput(text),
            stream_tokens: DEFAULT_STRATEGY.streamTokens,
            include_pings: DEFAULT_STRATEGY.includePings,
            streaming: true,
          });
        }
      }, "Stream") as AsyncIterable<any>;

      // 通知前端开始流式
      res.write(`data: ${JSON.stringify({ type: "stream_started" })}\n\n`);

      const extractText = (content: any) => {
        if (!content) return "";
        if (typeof content === "string") return content;
        if (Array.isArray(content)) {
          return content
            .filter((part: any) => part?.type === "text")
            .map((part: any) => part.text)
            .join("");
        }
        return "";
      };

      const writeAssistantContent = (content: string) => {
        if (!content) return;
        assistantContent += content;
        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
      };

      const handleChunk = (chunk: any) => {
        const messageType = chunk?.message_type || chunk?.messageType || chunk?.type;

        // 跳过 ping / 停止原因 / 统计
        if (messageType === "ping") return;
        if (messageType === "stop_reason") {
          return;
        }
        if (messageType === "usage_statistics") {
          console.log(`[Stream] Usage:`, chunk);
          return;
        }

        // ✅ assistant 消息（多种形态兼容）
        if (
          messageType === "assistant_message" ||
          messageType === "assistant_message_delta" ||
          messageType === "assistant_message_chunk"
        ) {
          const deltaContent = chunk?.delta?.content;
          const content = typeof deltaContent === "string" ? deltaContent : extractText(chunk?.content);
          writeAssistantContent(content);
          return;
        }

        // ✅ token 级别流式
        if (messageType === "text_stream_token") {
          const tokenContent = chunk?.token || "";
          writeAssistantContent(tokenContent);
          return;
        }

        // ✅ 推理消息
        if (messageType === "reasoning_message") {
          const reasoningContent = chunk?.reasoning || "";
          if (reasoningContent) {
            res.write(
              `data: ${JSON.stringify({
                type: "reasoning",
                content: reasoningContent,
                source: chunk?.source || "unknown",
              })}\n\n`
            );
          }
          return;
        }

        // ✅ 工具调用消息
        if (messageType === "tool_call_message") {
          const toolCall = chunk?.tool_call || chunk?.toolCall;
          res.write(`data: ${JSON.stringify({ type: "thinking", tool: toolCall?.name })}\n\n`);
          return;
        }

        // ✅ 工具返回消息（部分模型会把最终文本放在这里）
        if (messageType === "tool_return_message") {
          const toolReturn =
            chunk?.tool_return ||
            chunk?.toolReturn ||
            chunk?.return ||
            chunk?.result ||
            chunk?.output ||
            chunk?.data;

          const toolContent =
            (typeof toolReturn === "string" ? toolReturn : "") ||
            (typeof toolReturn?.content === "string" ? toolReturn.content : "") ||
            extractText(toolReturn?.content) ||
            (typeof chunk?.content === "string" ? chunk.content : "") ||
            extractText(chunk?.content) ||
            "";

          if (toolContent) {
            writeAssistantContent(toolContent);
          }
          return;
        }

        // ✅ 兜底：尝试从通用字段提取内容
        const fallbackContent =
          chunk?.choices?.[0]?.delta?.content ||
          chunk?.content ||
          chunk?.text ||
          "";
        if (typeof fallbackContent === "string" && fallbackContent) {
          writeAssistantContent(fallbackContent);
        }
      };

      const isAsyncIterable =
        stream && typeof (stream as any)[Symbol.asyncIterator] === "function";

      // ✅ 检查是否返回的是非流式结果（数组 / 单对象）
      if (Array.isArray(stream)) {
        for (const msg of stream) {
          const messageType = (msg as any).message_type || (msg as any).messageType || (msg as any).type;
          handleChunk(msg);
        }
      } else if (!isAsyncIterable) {
        handleChunk(stream);
      } else {
        // ✅ 处理流式响应（AsyncIterable）
        for await (const chunk of stream as AsyncIterable<any>) {
          const messageType = (chunk as any).message_type || (chunk as any).messageType || (chunk as any).type;
          handleChunk(chunk);
        }
      }

    } catch (error: any) {
      const isNetwork = isTransientError(error);
      console.error(`[Stream] ${isNetwork ? 'Network' : 'API'} error:`, error.message || error);
      const userMessage = isNetwork
        ? "网络连接失败，请检查网络后重试"
        : (error.message || "Stream error");
      res.write(`data: ${JSON.stringify({ error: userMessage, detail: error.message, retryable: isNetwork })}\n\n`);
    }

    // 2. 保存助手回复到数据库
    if (assistantContent) {
      const assistantMsgId = uuidv4();
      await pool.query(
        'INSERT INTO messages (id, agent_id, chat_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
        [assistantMsgId, roleId, chatId || null, 'assistant', assistantContent, Date.now()]
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
   * 新版 SDK (v1.x) API 变化适配
   */
  async sendMessageAsync(roleId: string, agentId: string, text: string, res: Response, images?: string[], chatId?: string) {
    // SSE headers
    res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");

    // 获取 Letta conversation_id（如果有）
    const lettaConversationId = await getLettaConversationId(chatId);

    // 1. 保存用户消息到数据库（不保存图片 base64，太大了）
    // 图片仍会发送给 Letta API，但不持久化到本地数据库
    const userMsgId = uuidv4();
    const hasImages = images && images.length > 0;
    // 只记录是否有图片，不保存实际内容
    const imageNote = hasImages ? `[包含 ${images.length} 张图片]` : null;
    await pool.query(
      'INSERT INTO messages (id, agent_id, chat_id, role, content, timestamp, images) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [userMsgId, roleId, chatId || null, 'user', text + (imageNote ? `\n${imageNote}` : ''), Date.now(), null]
    );
    
    // 更新 chat 的 updated_at
    if (chatId) {
      await pool.query('UPDATE chats SET updated_at = ? WHERE id = ?', [Date.now(), chatId]);
    }

    try {
      // ✅ 构建 Letta 消息内容（现在总是返回字符串）
      const messageContent = buildMessageContent(text, images);

      // ✅ 使用异步 API 创建后台任务（带重试）
      console.log(`[Async] Creating async message for agent ${agentId}${lettaConversationId ? `, conversation: ${lettaConversationId}` : ''}...`);

      const run = await retryOnTransientError(
        () => lettaClient.agents.messages.createAsync(agentId, {
          input: messageContent,
        }),
        "Async"
      );

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
        const currentRun = await retryOnTransientError(
          () => lettaClient.runs.retrieve(runId),
          "AsyncPoll"
        );
        
        // 状态变化时通知前端
        if (currentRun.status !== lastStatus) {
          console.log(`[Async] Run ${runId} status: ${lastStatus} -> ${currentRun.status}`);
          lastStatus = currentRun.status;
          res.write(`data: ${JSON.stringify({ type: "status_update", status: currentRun.status })}\n\n`);
        }

        // 检查是否完成
        if (currentRun.status === "completed") {
          // ✅ 获取完整的运行结果（包含消息）（带重试）
          const messagesPage = await retryOnTransientError(
            () => lettaClient.runs.messages.list(runId),
            "AsyncMessages"
          );
          
          // 提取 assistant 消息（新版 SDK 使用 message_type 而非 messageType）
          for await (const msg of messagesPage) {
            const messageType = (msg as any).message_type || (msg as any).messageType;
            
            // ✅ 处理推理消息
            if (messageType === "reasoning_message") {
              const reasoningContent = (msg as any).reasoning || "";
              if (reasoningContent) {
                res.write(`data: ${JSON.stringify({ 
                  type: "reasoning", 
                  content: reasoningContent,
                  source: (msg as any).source || "unknown"
                })}\n\n`);
              }
            }
            
            // 检查是否是 AssistantMessage 类型
            if (messageType === "assistant_message") {
              let content = "";
              const msgContent = (msg as any).content;
              // AssistantMessage.content 可能是 string 或 content parts 数组
              if (typeof msgContent === "string") {
                content = msgContent;
              } else if (Array.isArray(msgContent)) {
                // 如果是数组，提取文本部分
                content = msgContent
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
          'INSERT INTO messages (id, agent_id, chat_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?, ?)',
          [assistantMsgId, roleId, chatId || null, 'assistant', assistantContent, Date.now()]
        );
      }

      // 发送完成标记
      res.write(`data: [DONE]\n\n`);
      res.end();
    } catch (error: any) {
      const isNetwork = isTransientError(error);
      console.error(`[Async] ${isNetwork ? 'Network' : 'API'} error:`, error.message || error);
      const userMessage = isNetwork
        ? "网络连接失败，请检查网络后重试"
        : (error.message || "Failed to process message");
      res.write(`data: ${JSON.stringify({ error: userMessage, detail: error.message, retryable: isNetwork })}\n\n`);
      res.end();
    }
  },

  async getHistory(roleId: string, chatId?: string) {
    let query = 'SELECT * FROM messages WHERE agent_id = ?';
    const params: (string | null)[] = [roleId];
    
    if (chatId) {
      query += ' AND chat_id = ?';
      params.push(chatId);
    } else {
      // 默认历史只显示未绑定 chat 的消息，避免跨 chat 混入
      query += ' AND chat_id IS NULL';
    }
    
    query += ' ORDER BY timestamp ASC';
    
    const [rows] = await pool.query<MessageRow[] & RowDataPacket[]>(query, params);
    return rows.map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      timestamp: row.timestamp,
      images: row.images ? JSON.parse(row.images) : undefined
    }));
  },

  async deleteHistory(agentId: string): Promise<DeleteResult> {
    try {
      // 1. 先从数据库获取对应的 Letta agent_id
      const [agentRows] = await pool.query<RowDataPacket[]>(
        'SELECT agent_id FROM agents WHERE id = ?',
        [agentId]
      );
      
      const lettaAgentId = agentRows[0]?.agent_id;

      // 2. 如果有 Letta agent_id，调用 API 重置 agent 的消息记忆
      if (lettaAgentId) {
        try {
          await lettaClient.agents.messages.reset(lettaAgentId, {
            add_default_initial_messages: true
          });
          console.log(`[Message] Reset Letta agent messages for ${lettaAgentId}`);
        } catch (lettaError) {
          // 即使 Letta API 失败，仍然继续删除本地记录
          console.error("Failed to reset Letta agent messages:", lettaError);
        }
      }

      // 3. 删除本地数据库中的消息
      const [result] = await pool.query<ResultSetHeader>('DELETE FROM messages WHERE agent_id = ?', [agentId]);
      const deleted = result.affectedRows;
      console.log(`[Message] Deleted ${deleted} messages for agent ${agentId}`);
      return { success: true, deleted };
    } catch (e) {
      console.error("Failed to delete history:", e);
      throw e;
    }
  },

  async deleteMessage(messageId: string): Promise<DeleteResult> {
    try {
      // 删除数据库中的单条消息
      const [result] = await pool.query<ResultSetHeader>('DELETE FROM messages WHERE id = ?', [messageId]);
      const deleted = result.affectedRows;
      console.log(`[Message] Deleted message ${messageId}, affected rows: ${deleted}`);
      return { success: deleted > 0, deleted };
    } catch (e) {
      console.error("Failed to delete message:", e);
      throw e;
    }
  }
};
