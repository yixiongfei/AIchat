"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageService = void 0;
const db_1 = __importDefault(require("../storage/db"));
const uuid_1 = require("uuid");
require("dotenv/config");
const client_1 = require("./client");
function normalizeBaseUrl(url) {
    return url.replace(/\/$/, "");
}
// 将用户输入用不可混淆的边界包起来，防止提示词注入
function wrapUserInput(input) {
    const start = "<<<USER_INPUT_START>>>";
    const end = "<<<USER_INPUT_END>>>";
    return `${start}\n${input}\n${end}`;
}
// ✅ 从 base64 data URI 中解析出 mediaType 和纯 base64 数据
function parseBase64Image(dataUri) {
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
function buildMessageContent(text, images) {
    // 如果没有图片，返回包装后的纯文本
    if (!images || images.length === 0) {
        return wrapUserInput(text);
    }
    // 有图片时，构建 Letta 官方多模态内容数组
    const content = [];
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
                    mediaType: parsed.mediaType, // ✅ 使用 camelCase（Letta SDK 要求）
                    data: parsed.data
                }
            });
        }
    }
    return content;
}
// ✅ 延时函数
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
// ✅ 从 Run 结果中提取 assistant 消息内容
function extractAssistantContent(run) {
    if (!run.messages || !Array.isArray(run.messages)) {
        return "";
    }
    // 过滤出 assistant 消息并合并内容
    const assistantMessages = run.messages.filter((msg) => msg.role === "assistant" || msg.message_type === "assistant_message");
    return assistantMessages
        .map((msg) => {
        // 尝试多种可能的内容字段
        if (typeof msg.content === "string")
            return msg.content;
        if (msg.assistant_message)
            return msg.assistant_message;
        if (msg.text)
            return msg.text;
        return "";
    })
        .filter(Boolean)
        .join("");
}
const DEFAULT_STRATEGY = {
    forceAsyncForImages: true, // 图片消息使用异步
    longTextThreshold: 5000, // 5000 字符以上使用异步
    streamTokens: true, // 启用 token 流式
    includePings: true, // 启用 ping 保活
    asyncPollInterval: 500, // 500ms 轮询
    asyncMaxWaitTime: 5 * 60 * 1000, // 5 分钟超时
};
/**
 * 决定使用哪种消息发送策略
 */
function chooseStrategy(text, images, config = DEFAULT_STRATEGY) {
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
async function getLettaConversationId(chatId) {
    if (!chatId)
        return null;
    try {
        const [rows] = await db_1.default.query('SELECT letta_conversation_id FROM chats WHERE id = ?', [chatId]);
        const chats = rows;
        return chats.length > 0 ? chats[0].letta_conversation_id : null;
    }
    catch (error) {
        console.error("[getLettaConversationId] Error:", error);
        return null;
    }
}
exports.messageService = {
    /**
     * 智能消息发送（自动选择最优策略）
     */
    async sendMessageStream(roleId, agentId, text, res, images, chatId) {
        const strategy = chooseStrategy(text, images);
        if (strategy === "stream") {
            return this.sendMessageStreamSync(roleId, agentId, text, res, chatId);
        }
        else {
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
    async sendMessageStreamSync(roleId, agentId, text, res, chatId) {
        // SSE headers
        res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        // 获取 Letta conversation_id（如果有）
        const lettaConversationId = await getLettaConversationId(chatId);
        // 1. 保存用户消息到数据库
        const userMsgId = (0, uuid_1.v4)();
        await db_1.default.query('INSERT INTO messages (id, agent_id, chat_id, role, content, timestamp, images) VALUES (?, ?, ?, ?, ?, ?, ?)', [userMsgId, roleId, chatId || null, 'user', text, Date.now(), null]);
        // 更新 chat 的 updated_at
        if (chatId) {
            await db_1.default.query('UPDATE chats SET updated_at = ? WHERE id = ?', [Date.now(), chatId]);
        }
        let assistantContent = "";
        try {
            console.log(`[Stream] Starting streaming for agent ${agentId}${lettaConversationId ? `, conversation: ${lettaConversationId}` : ''}...`);
            let stream;
            // ✅ 根据是否有 conversation_id 选择不同的 API
            if (lettaConversationId) {
                // 使用 conversation 专用 API，确保消息隔离
                stream = await client_1.lettaClient.conversations.messages.create(lettaConversationId, {
                    input: wrapUserInput(text),
                    stream_tokens: DEFAULT_STRATEGY.streamTokens,
                    include_pings: DEFAULT_STRATEGY.includePings,
                });
            }
            else {
                // 使用传统的 agent API（向后兼容）
                stream = await client_1.lettaClient.agents.messages.create(agentId, {
                    input: wrapUserInput(text),
                    stream_tokens: DEFAULT_STRATEGY.streamTokens,
                    include_pings: DEFAULT_STRATEGY.includePings,
                    streaming: true,
                });
            }
            // 通知前端开始流式
            res.write(`data: ${JSON.stringify({ type: "stream_started" })}\n\n`);
            // ✅ 处理流式响应
            for await (const chunk of stream) {
                // 新版 SDK 使用 message_type（下划线格式）
                const messageType = chunk.message_type || chunk.messageType;
                // 跳过 ping 消息
                if (messageType === "ping") {
                    continue;
                }
                // 处理停止原因
                if (messageType === "stop_reason") {
                    console.log(`[Stream] Stop reason: ${chunk.stop_reason || chunk.stopReason}`);
                    continue;
                }
                // 处理使用统计
                if (messageType === "usage_statistics") {
                    console.log(`[Stream] Usage:`, chunk);
                    continue;
                }
                // ✅ 处理 assistant 消息
                if (messageType === "assistant_message") {
                    let content = "";
                    if (typeof chunk.content === "string") {
                        content = chunk.content;
                    }
                    else if (Array.isArray(chunk.content)) {
                        content = chunk.content
                            .filter((part) => part.type === "text")
                            .map((part) => part.text)
                            .join("");
                    }
                    if (content) {
                        assistantContent += content;
                        // 以 SSE 格式发送内容
                        res.write(`data: ${JSON.stringify({ choices: [{ delta: { content } }] })}\n\n`);
                    }
                }
                // ✅ 处理推理消息（reasoning_message）
                if (messageType === "reasoning_message") {
                    const reasoningContent = chunk.reasoning || "";
                    if (reasoningContent) {
                        res.write(`data: ${JSON.stringify({
                            type: "reasoning",
                            content: reasoningContent,
                            source: chunk.source || "unknown"
                        })}\n\n`);
                    }
                }
                // 处理工具调用消息（可选：通知前端正在思考）
                if (messageType === "tool_call_message") {
                    const toolCall = chunk.tool_call || chunk.toolCall;
                    res.write(`data: ${JSON.stringify({ type: "thinking", tool: toolCall?.name })}\n\n`);
                }
            }
            console.log(`[Stream] Completed, content length: ${assistantContent.length}`);
        }
        catch (error) {
            console.error("[Stream] Error:", error);
            res.write(`data: ${JSON.stringify({ error: "Stream error", detail: error.message })}\n\n`);
        }
        // 2. 保存助手回复到数据库
        if (assistantContent) {
            const assistantMsgId = (0, uuid_1.v4)();
            await db_1.default.query('INSERT INTO messages (id, agent_id, chat_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?, ?)', [assistantMsgId, roleId, chatId || null, 'assistant', assistantContent, Date.now()]);
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
    async sendMessageAsync(roleId, agentId, text, res, images, chatId) {
        // SSE headers
        res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
        res.setHeader("Cache-Control", "no-cache, no-transform");
        res.setHeader("Connection", "keep-alive");
        // 获取 Letta conversation_id（如果有）
        const lettaConversationId = await getLettaConversationId(chatId);
        // 1. 保存用户消息到数据库（不保存图片 base64，太大了）
        // 图片仍会发送给 Letta API，但不持久化到本地数据库
        const userMsgId = (0, uuid_1.v4)();
        const hasImages = images && images.length > 0;
        // 只记录是否有图片，不保存实际内容
        const imageNote = hasImages ? `[包含 ${images.length} 张图片]` : null;
        await db_1.default.query('INSERT INTO messages (id, agent_id, chat_id, role, content, timestamp, images) VALUES (?, ?, ?, ?, ?, ?, ?)', [userMsgId, roleId, chatId || null, 'user', text + (imageNote ? `\n${imageNote}` : ''), Date.now(), null]);
        // 更新 chat 的 updated_at
        if (chatId) {
            await db_1.default.query('UPDATE chats SET updated_at = ? WHERE id = ?', [Date.now(), chatId]);
        }
        try {
            // ✅ 构建 Letta 官方多模态消息内容
            const messageContent = buildMessageContent(text, images);
            // ✅ 使用异步 API 创建后台任务
            console.log(`[Async] Creating async message for agent ${agentId}${lettaConversationId ? `, conversation: ${lettaConversationId}` : ''}...`);
            // 新版 SDK 使用不同的参数名（下划线格式）
            const run = await client_1.lettaClient.agents.messages.createAsync(agentId, {
                input: typeof messageContent === 'string' ? messageContent : undefined,
                messages: typeof messageContent !== 'string' ? [{ role: "user", content: messageContent }] : undefined,
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
                const currentRun = await client_1.lettaClient.runs.retrieve(runId);
                // 状态变化时通知前端
                if (currentRun.status !== lastStatus) {
                    console.log(`[Async] Run ${runId} status: ${lastStatus} -> ${currentRun.status}`);
                    lastStatus = currentRun.status;
                    res.write(`data: ${JSON.stringify({ type: "status_update", status: currentRun.status })}\n\n`);
                }
                // 检查是否完成
                if (currentRun.status === "completed") {
                    // ✅ 获取完整的运行结果（包含消息）
                    const messagesPage = await client_1.lettaClient.runs.messages.list(runId);
                    // 提取 assistant 消息（新版 SDK 使用 message_type 而非 messageType）
                    for await (const msg of messagesPage) {
                        const messageType = msg.message_type || msg.messageType;
                        // ✅ 处理推理消息
                        if (messageType === "reasoning_message") {
                            const reasoningContent = msg.reasoning || "";
                            if (reasoningContent) {
                                res.write(`data: ${JSON.stringify({
                                    type: "reasoning",
                                    content: reasoningContent,
                                    source: msg.source || "unknown"
                                })}\n\n`);
                            }
                        }
                        // 检查是否是 AssistantMessage 类型
                        if (messageType === "assistant_message") {
                            let content = "";
                            const msgContent = msg.content;
                            // AssistantMessage.content 可能是 string 或 content parts 数组
                            if (typeof msgContent === "string") {
                                content = msgContent;
                            }
                            else if (Array.isArray(msgContent)) {
                                // 如果是数组，提取文本部分
                                content = msgContent
                                    .filter((part) => part.type === "text")
                                    .map((part) => part.text)
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
                    const errorMsg = currentRun.callback_error || `Run ${currentRun.status}`;
                    console.error(`[Async] Run ${runId} failed:`, errorMsg);
                    res.write(`data: ${JSON.stringify({ error: errorMsg })}\n\n`);
                    break;
                }
            }
            // 2. 保存助手回复到数据库
            if (assistantContent) {
                const assistantMsgId = (0, uuid_1.v4)();
                await db_1.default.query('INSERT INTO messages (id, agent_id, chat_id, role, content, timestamp) VALUES (?, ?, ?, ?, ?, ?)', [assistantMsgId, roleId, chatId || null, 'assistant', assistantContent, Date.now()]);
            }
            // 发送完成标记
            res.write(`data: [DONE]\n\n`);
            res.end();
        }
        catch (error) {
            console.error("[Async] Error:", error);
            res.write(`data: ${JSON.stringify({ error: "Failed to process message", detail: error.message })}\n\n`);
            res.end();
        }
    },
    async getHistory(roleId, chatId) {
        let query = 'SELECT * FROM messages WHERE agent_id = ?';
        const params = [roleId];
        if (chatId) {
            query += ' AND chat_id = ?';
            params.push(chatId);
        }
        query += ' ORDER BY timestamp ASC';
        const [rows] = await db_1.default.query(query, params);
        return rows.map((row) => ({
            id: row.id,
            role: row.role,
            content: row.content,
            timestamp: row.timestamp,
            images: row.images ? JSON.parse(row.images) : undefined
        }));
    },
    async deleteHistory(agentId) {
        try {
            const [result] = await db_1.default.query('DELETE FROM messages WHERE agent_id = ?', [agentId]);
            const deleted = result?.affectedRows ?? result?.affected ?? 0;
            console.log(`[Message] Deleted ${deleted} messages for agent ${agentId}`);
            return { success: true, deleted };
        }
        catch (e) {
            console.error("Failed to delete history:", e);
            throw e;
        }
    }
};
