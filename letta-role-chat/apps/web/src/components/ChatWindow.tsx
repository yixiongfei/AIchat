import React, { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Role, Message } from "../types";
import { Send, Loader2 } from "lucide-react";
import { api } from "../services/api";
import useTTS from "../hooks/useTTS";
import Markdown from "./Markdown";
import {
  showWaifuMessage,
  showWaifuStreamUpdate,
  clearWaifuTimers,
} from "../utils/live2dBridge";
import SelectionTTSButton from "./SelectionTTSButton";

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

// ===== 折叠长代码：helper =====
type CodeBlockInfo = {
  language: string;
  code: string;
  lines: number;
  chars: number;
};

// 提取第一段 fenced code（```lang ... ```）
function extractFirstFencedCode(text: string): CodeBlockInfo | null {
  const re = /```(\w+)?\n([\s\S]*?)```/m;
  const m = text.match(re);
  if (!m) return null;

  const language = (m[1] || "text").toLowerCase();
  const code = m[2] || "";
  const lines = code.split("\n").length;
  const chars = code.length;
  return { language, code, lines, chars };
}

function shouldCollapseMessage(text: string) {
  const totalChars = text.length;
  const block = extractFirstFencedCode(text);

  // 你可以调这些阈值
  const CODE_LINE_THRESHOLD = 30;
  const CODE_CHAR_THRESHOLD = 1200;
  const TEXT_CHAR_THRESHOLD = 2000;

  const hasLongCode =
    !!block && (block.lines >= CODE_LINE_THRESHOLD || block.chars >= CODE_CHAR_THRESHOLD);

  const hasVeryLongText = totalChars >= TEXT_CHAR_THRESHOLD;

  return { collapse: hasLongCode || hasVeryLongText, block };
}

function previewText(text: string, maxChars = 240) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= maxChars) return t;
  return t.slice(0, maxChars) + "…";
}

// 可选：打开你之前做的右侧代码面板（Artifacts）
function openArtifact(title: string, language: string, code: string) {
  window.dispatchEvent(
    new CustomEvent("open-artifact", {
      detail: { title, language, code },
    })
  );
}
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
  onAutoSpeakChange?: (value: boolean) => void;
}

// ✅ 暴露给父组件的方法接口
export interface ChatWindowHandle {
  toggleAutoSpeak: () => void;
  stopSpeak: () => void;
  clearHistory: () => Promise<void>;
}

export const ChatWindow = forwardRef<ChatWindowHandle, ChatWindowProps>(({
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
  onAutoSpeakChange,
}, ref) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [autoSpeak, setAutoSpeak] = useState(defaultAutoSpeak);
  // 每条消息是否展开：key=msg.id
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});
  const toggleExpanded = (id: string) => {
    setExpandedMap(prev => ({ ...prev, [id]: !prev[id] }));
  };


  // ✅ 同步 autoSpeak 状态变化
  useEffect(() => {
    setAutoSpeak(defaultAutoSpeak);
  }, [defaultAutoSpeak]);

  // ✅ 当 autoSpeak 改变时通知父组件
  const handleAutoSpeakChange = (value: boolean) => {
    setAutoSpeak(value);
    onAutoSpeakChange?.(value);
  };

  // ✅ 使用增强后的 useTTS Hook
  const { appendStream, flushStream, stop } = useTTS({
    voice: role?.voice,
    speed: role?.speed,
    pitch: role?.pitch,
    style: role?.style,
  });

  // ✅ 暴露方法给父组件（移动端顶部栏使用）
  useImperativeHandle(ref, () => ({
    toggleAutoSpeak: () => handleAutoSpeakChange(!autoSpeak),
    stopSpeak: stop,
    clearHistory: async () => {
      if (!role?.id) return;
      const confirm = window.prompt('为防止误删,请输入 DELETE 确认清空历史');
      if (confirm !== 'DELETE') return;
      try {
        await api.deleteHistory(role.id);
        setMessages([]);
        showWaifuMessage('历史已清空', 3000, 20, true);
      } catch (e) {
        console.error('Failed to delete history', e);
        showWaifuMessage('清空失败', 3000, 20, true);
      }
    }
  }), [role?.id, stop, autoSpeak]);

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
      stop();
    };
  }, [stop]);

  // 发送消息
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

          // ✅ 简化：直接调用 appendStream，内部自动处理分段
          if (autoSpeak) {
            appendStream(chunk, {
              minLength: 20,        // 最少积累 20 字符
              sentenceLength: 30,   // 完整句子至少 30 字符
              maxLength: 150,       // 超过 150 强制分段
              pauseLength: 60,      // 逗号分句至少 60 字符
              debounceMs: 500,      // 防抖延迟 500ms
            });
          }
        },
        async () => {
          setIsLoading(false);

          if (assistantContent.trim()) {
            showWaifuMessage(assistantContent, 8000, 10, true);

            // ✅ 流式结束后刷新剩余缓冲
            if (autoSpeak) {
              await flushStream();
            }
          }
        }
      );
    } catch (error) {
      console.error("Chat error:", error);
      setIsLoading(false);
      showWaifuMessage("好像出错了…要不要再试一次?", 5000, 20, true);
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
                onClick={() => handleAutoSpeakChange(!autoSpeak)}
                className={cn(
                  "text-xs px-2 py-1 rounded-md ring-1 ring-current/20 transition",
                  autoSpeak ? "bg-primary/10 opacity-100" : "opacity-60 hover:opacity-100"
                )}
                title="Auto Speak"
              >
                {autoSpeak ? "自动朗读:开" : "自动朗读:关"}
              </button>

              <button
                onClick={stop}
                className="text-xs px-2 py-1 rounded-md ring-1 ring-current/20 opacity-60 hover:opacity-100 transition"
                title="Stop"
              >
                停止
              </button>

              <button
                onClick={async () => {
                  if (!role?.id) return;
                  const confirm = window.prompt('为防止误删,请输入 DELETE 确认清空历史');
                  if (confirm !== 'DELETE') return;
                  try {
                    await api.deleteHistory(role.id);
                    setMessages([]);
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
        <div ref={containerRef} className="w-full">
          <div className={cn("mx-auto w-full max-w-3xl space-y-2", bodyInnerClassName)}>
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

                    {(() => {
                      const { collapse, block } = shouldCollapseMessage(msg.content);
                      const expanded = !!expandedMap[msg.id];

                      // 如果不需要折叠，保持你原来逻辑不变
                      if (!collapse) {
                        return isUser ? (
                          <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        ) : (
                          <Markdown
                            text={msg.content}
                            className="
          prose prose-invert break-words
          prose-headings:mt-4 prose-headings:mb-2
          prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
          prose-p:my-2
          prose-ul:my-2 prose-ol:my-2
          prose-li:my-1
          prose-li:leading-relaxed
          [&_.prose_li>p]:my-0
          [&_.prose_li>p]:leading-relaxed
        "
                          />
                        );
                      }

                      // 需要折叠：显示一个折叠头 + 内容（可展开）
                      return (
                        <div className="w-full">
                          {/* 折叠头 */}
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="text-xs text-slate-300/80">
                              {block
                                ? `代码块（${block.language.toUpperCase()}） · ${block.lines} 行`
                                : `长消息 · ${msg.content.length} 字符`}
                            </div>

                            <div className="flex items-center gap-2">
                              {/* 可选：如果有 code block，提供“在侧边栏打开” */}
                              {block && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    openArtifact(
                                      `${role.name}-snippet`,
                                      block.language,
                                      block.code
                                    )
                                  }
                                  className="text-xs px-2 py-1 rounded-md bg-slate-800/50 hover:bg-slate-800 ring-1 ring-white/10 transition"
                                  title="在侧边栏打开"
                                >
                                  在侧边栏打开
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => toggleExpanded(msg.id)}
                                className="text-xs px-2 py-1 rounded-md bg-slate-800/50 hover:bg-slate-800 ring-1 ring-white/10 transition"
                              >
                                {expanded ? "收起" : "展开"}
                              </button>
                            </div>
                          </div>

                          {/* 折叠内容 */}
                          {!expanded ? (
                            // 折叠态：显示预览（不渲染 Markdown，避免太长）
                            <div className="text-sm text-slate-200/90 whitespace-pre-wrap break-words">
                              {block
                                ? previewText(block.code, 260) // 预览代码
                                : previewText(msg.content, 260)}
                            </div>
                          ) : (
                            // 展开态：渲染原内容（保持你原来 Markdown 展示）
                            <>
                              {isUser ? (
                                <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                              ) : (
                                <Markdown
                                  text={msg.content}
                                  className="
                                    prose prose-invert break-words
                                    prose-headings:mt-4 prose-headings:mb-2
                                    prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
                                    prose-p:my-2
                                    prose-ul:my-2 prose-ol:my-2
                                    prose-li:my-1
                                    prose-li:leading-relaxed
                                    [&_.prose_li>p]:my-0
                                    [&_.prose_li>p]:leading-relaxed
                                  "
                                />
                              )}
                            </>
                          )}
                        </div>
                      );
                    })()}
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
        <SelectionTTSButton
          containerRef={containerRef}
          roleConfig={{
            voice: role?.voice,
            speed: role?.speed,
            pitch: role?.pitch,
            style: role?.style,
          }}
        />
      </div>

      <div className={cn("shrink-0 px-4 py-4", inputBarClassName)}>
        <div className="mx-auto w-full max-w-[1100px]">
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
        </div>
      </div>
    </div>
  );
});