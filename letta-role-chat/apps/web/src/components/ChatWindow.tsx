
import React, { useState, useRef, useEffect } from "react";
import { Role, Message } from "../types";
import { Send, Loader2 } from "lucide-react";
import { api } from "../services/api";
import useTTS from "../hooks/useTTS";
import {
  showWaifuMessage,
  showWaifuStreamUpdate,
  clearWaifuTimers,
} from "../utils/live2dBridge";

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

interface ChatWindowProps {
  role: Role;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  bodyInnerClassName?: string;
  inputBarClassName?: string;
  inputClassName?: string;
  sendButtonClassName?: string;
  userBubbleClassName?: string;
  assistantBubbleClassName?: string;
  showHeader?: boolean;
  defaultAutoSpeak?: boolean;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  role,
  className,
  headerClassName,
  bodyClassName,
  bodyInnerClassName,
  inputBarClassName,
  inputClassName,
  sendButtonClassName,
  userBubbleClassName,
  assistantBubbleClassName,
  showHeader = true,
  defaultAutoSpeak = false,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  /** ✅ TTS：自动朗读开关 */
  const [autoSpeak, setAutoSpeak] = useState(defaultAutoSpeak);

  // pending buffer 保留在 ChatWindow，用以决定何时 flush 到 TTS
  const pendingTTSRef = useRef<{ buffer: string; timer: number | null }>({ buffer: '', timer: null });

  // 使用 Hook 管理 TTS 队列、请求与播放顺序
  const tts = useTTS({ voice: role.voice, speed: role.speed, pitch: role.pitch, style: role.style });

   // TTS 由后端负责决定发送哪个段落（例如带有翻译的文本），前端不再截取。
   // 保持前端发送完整文本，让后端对管道分段（'|' 或 '｜'）进行日语段识别并调用 TTS。

  // 加载历史记录
  useEffect(() => {
    const loadHistory = async () => {
      setMessages([]);
      try {
        const history = await api.getHistory(role.id);
        setMessages(history);
      } catch (error) {
        console.error("Failed to load history:", error);
      }
    };
    loadHistory();
  }, [role.id]);

  // 自动滚动到底部
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // 卸载清理
  useEffect(() => {
    return () => {
      clearWaifuTimers();
      stopSpeak();
    };
  }, []);

  // =========================
  // ✅ TTS：停止播放并清理
  // =========================
  const stopSpeak = async () => {
    // 交由 tts hook 停止并清理队列；同时清除 pending 缓冲
    try {
      await tts.stop();
    } catch (e) {
      console.error('tts.stop error:', e);
    }

    if (pendingTTSRef.current.timer) {
      window.clearTimeout(pendingTTSRef.current.timer);
      pendingTTSRef.current.timer = null;
      pendingTTSRef.current.buffer = '';
    }
  };

  // =========================
  // 发送消息
  // =========================
  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const contentToSend = input.trim();
    const userMsg: Message = {
      id: "user-" + Date.now(),
      role: "user",
      content: contentToSend,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    showWaifuMessage("让我想想…", 2000, 9, true);

    const assistantMsgId = "assistant-" + Date.now();
    let assistantContent = "";

    try {
      await api.sendMessageStream(
        role.id,
        contentToSend,
        (chunk) => {
          assistantContent += chunk;

          setMessages((prev) => {
            const other = prev.filter((m) => m.id !== assistantMsgId);
            return [
              ...other,
              {
                id: assistantMsgId,
                role: "assistant",
                content: assistantContent,
                timestamp: Date.now(),
              },
            ];
          });

          showWaifuStreamUpdate(assistantContent, {
            throttleMs: 120,
            priority: 10,
            timeout: 12000,
            override: true,
          });

            // 如果自动朗读，按块累积并防抖请求 TTS（避免每个 delta 都调用 TTS）
            if (autoSpeak) {
              pendingTTSRef.current.buffer += chunk;

              const buf = pendingTTSRef.current.buffer.trim();
              const bufLen = buf.length;
              const endsWithSentence = /[。！？!?\.]+$/.test(buf);

              // 决策策略：
              // - 如果达到较大长度（120），立即发送（长段落直接读）
              // - 或者缓冲以句号/问号等结尾且长度至少 40，立即发送（完整句子）
              // - 否则延迟短暂时间等待更多内容或句末标点
              if (bufLen >= 120 || (endsWithSentence && bufLen >= 40)) {
                const toSend = buf;
                pendingTTSRef.current.buffer = '';
                if (pendingTTSRef.current.timer) {
                  window.clearTimeout(pendingTTSRef.current.timer);
                  pendingTTSRef.current.timer = null;
                }
                // 直接使用 hook 的入队接口（后端负责日语段识别）
                tts.enqueue(toSend);
              } else {
                if (pendingTTSRef.current.timer) {
                  window.clearTimeout(pendingTTSRef.current.timer);
                }
                // 等待短时间，给流更多机会完成当前句子
                pendingTTSRef.current.timer = window.setTimeout(() => {
                  const toSend = pendingTTSRef.current.buffer.trim();
                  pendingTTSRef.current.buffer = '';
                  pendingTTSRef.current.timer = null;
                  if (toSend) {
                    tts.enqueue(toSend);
                  }
                }, 300);
              }
            }
        },
        async () => {
          setIsLoading(false);

          if (assistantContent.trim()) {
            showWaifuMessage(assistantContent, 8000, 10, true);

            // ✅ 流式结束后朗读：先把待发送的 buffer 刷出
            if (autoSpeak) {
              if (pendingTTSRef.current.timer) {
                window.clearTimeout(pendingTTSRef.current.timer);
                pendingTTSRef.current.timer = null;
              }
              const remaining = pendingTTSRef.current.buffer.trim();
              pendingTTSRef.current.buffer = '';
              if (remaining) {
                await tts.enqueue(remaining);
              }
            }
          }
        }
      );
    } catch (error) {
      console.error("Chat error:", error);
      setIsLoading(false);
      showWaifuMessage("好像出错了…要不要再试一次？", 5000, 20, true);
    }
  };

  return (
    <div className={cn("flex h-full min-w-0 flex-col", className)}>
      {showHeader && (
        <div className={cn("shrink-0 px-4 py-3", headerClassName)}>
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="font-semibold truncate">{role.name}</div>
              <div className="text-xs opacity-70">Online</div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setAutoSpeak((v) => !v)}
                className={cn(
                  "text-xs px-2 py-1 rounded-md ring-1 ring-current/20 transition",
                  autoSpeak ? "bg-primary/10 opacity-100" : "opacity-60 hover:opacity-100"
                )}
                title="Auto Speak"
              >
                {autoSpeak ? "自动朗读：开" : "自动朗读：关"}
              </button>

              <button
                onClick={stopSpeak}
                className="text-xs px-2 py-1 rounded-md ring-1 ring-current/20 opacity-60 hover:opacity-100 transition"
                title="Stop"
              >
                停止
              </button>

              <button
                onClick={async () => {
                  if (!role?.id) return;
                  const confirm = window.prompt('为防止误删，请输入 DELETE 确认清空历史');
                  if (confirm !== 'DELETE') return;
                  try {
                    await api.deleteHistory(role.id);
                    setMessages([]);
                    // 可显示短提示
                    showWaifuMessage('历史已清空', 3000, 20, true);
                  } catch (e) {
                    console.error('Failed to delete history', e);
                    showWaifuMessage('清空失败', 3000, 20, true);
                  }
                }}
                className="text-xs px-2 py-1 rounded-md ring-1 ring-current/20 opacity-60 hover:opacity-100 transition"
                title="Clear History"
              >
                清空历史
              </button>

              <div className="text-xs opacity-60">{messages.length} msgs</div>
            </div>
          </div>
        </div>
      )}

      <div ref={scrollRef} className={cn("flex-1 overflow-y-auto px-4 py-4", bodyClassName)}>
        <div className={cn("mx-auto w-full max-w-3xl space-y-4", bodyInnerClassName)}>
          {messages.map((msg) => {
            const isUser = msg.role === "user";
            return (
              <div key={msg.id} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    isUser
                      ? cn("rounded-tr-md", userBubbleClassName)
                      : cn("rounded-tl-md", assistantBubbleClassName)
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                </div>
              </div>
            );
          })}

          {isLoading &&
            !messages.some((m) => m.role === "assistant" && m.id.startsWith("assistant-")) && (
              <div className="flex justify-start">
                <div className={cn("rounded-2xl rounded-tl-md px-4 py-3", assistantBubbleClassName)}>
                  <Loader2 className="animate-spin opacity-70" size={18} />
                </div>
              </div>
            )}
        </div>
      </div>

      <div className={cn("shrink-0 px-4 py-4", inputBarClassName)}>
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setInput(e.target.value)}
            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`Message ${role.name}...`}
            rows={2}
            className={cn(
              "flex-1 resize-none rounded-2xl px-4 py-3 text-sm outline-none",
              "min-h-[56px] max-h-[160px]",
              inputClassName
            )}
          />

          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className={cn(
              "h-12 w-12 rounded-2xl inline-flex items-center justify-center transition",
              "disabled:opacity-50 disabled:cursor-not-allowed",
              sendButtonClassName
            )}
            title="Send"
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>

        <p className="mt-2 text-xs opacity-60">Enter 发送，Shift+Enter 换行</p>
      </div>
    </div>
  );
};
