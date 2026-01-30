
import React, {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Role, Message } from "../types";
import { Send, Loader2 } from "lucide-react";
import { api } from "../services/api";
import useTTS from "../hooks/useTTS";
import {
  showWaifuMessage,
  showWaifuStreamUpdate,
  clearWaifuTimers,
} from "../utils/live2dBridge";
import SelectionTTSButton from "./SelectionTTSButton";
import MessageBubble from "./MessageBubble";
import { previewText, stripAllFencedCodes } from "../utils/codeSegmentation";

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
  onAutoSpeakChange?: (value: boolean) => void;

  // ✅ 长代码自动打开侧边栏（默认 true）
  autoOpenLongCode?: boolean;
}

export interface ChatWindowHandle {
  toggleAutoSpeak: () => void;
  stopSpeak: () => void;
  clearHistory: () => Promise<void>;
}

export const ChatWindow = forwardRef<ChatWindowHandle, ChatWindowProps>(
  (
    {
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
      autoOpenLongCode = true,
    },
    ref
  ) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);

    const scrollRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [autoSpeak, setAutoSpeak] = useState(defaultAutoSpeak);

    // 每条消息是否展开：key=msg.id
    const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});

    const toggleExpanded = (id: string) => {
      setExpandedMap((prev) => ({ ...prev, [id]: !prev[id] }));
    };

    // 同步 autoSpeak
    useEffect(() => {
      setAutoSpeak(defaultAutoSpeak);
    }, [defaultAutoSpeak]);

    const handleAutoSpeakChange = (value: boolean) => {
      setAutoSpeak(value);
      onAutoSpeakChange?.(value);
    };

    const { appendStream, flushStream, stop } = useTTS({
      voice: role?.voice,
      speed: role?.speed,
      pitch: role?.pitch,
      style: role?.style,
    });

    useImperativeHandle(
      ref,
      () => ({
        toggleAutoSpeak: () => handleAutoSpeakChange(!autoSpeak),
        stopSpeak: stop,
        clearHistory: async () => {
          if (!role?.id) return;
          const confirm = window.prompt("为防止误删,请输入 DELETE 确认清空历史");
          if (confirm !== "DELETE") return;
          try {
            await api.deleteHistory(role.id);
            setMessages([]);
            showWaifuMessage("历史已清空", 3000, 20, true);
          } catch (e) {
            console.error("Failed to delete history", e);
            showWaifuMessage("清空失败", 3000, 20, true);
          }
        },
      }),
      [role?.id, stop, autoSpeak]
    );

    // 加载历史
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

            if (autoSpeak) {
              appendStream(chunk, {
                minLength: 20,
                sentenceLength: 30,
                maxLength: 150,
                pauseLength: 60,
                debounceMs: 500,
              });
            }
          },
          async () => {
            setIsLoading(false);

            // waifu 提示用“去代码摘要”，避免刷屏
            const brief = previewText(stripAllFencedCodes(assistantContent), 220);
            if (assistantContent.trim()) showWaifuMessage(brief || "已完成", 6000, 10, true);

            if (autoSpeak) await flushStream();
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
                    autoSpeak
                      ? "bg-primary/10 opacity-100"
                      : "opacity-60 hover:opacity-100"
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
                    const confirm = window.prompt("为防止误删,请输入 DELETE 确认清空历史");
                    if (confirm !== "DELETE") return;
                    try {
                      await api.deleteHistory(role.id);
                      setMessages([]);
                      showWaifuMessage("历史已清空", 3000, 20, true);
                    } catch (e) {
                      console.error("Failed to delete history", e);
                      showWaifuMessage("清空失败", 3000, 20, true);
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
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  role={role}
                  userBubbleClassName={userBubbleClassName}
                  assistantBubbleClassName={assistantBubbleClassName}
                  expanded={!!expandedMap[msg.id]}
                  onToggleExpanded={() => toggleExpanded(msg.id)}
                  autoOpenLongCode={autoOpenLongCode}
                />
              ))}

              {isLoading &&
                !messages.some(
                  (m) => m.role === "assistant" && m.id.startsWith("assistant-")
                ) && (
                  <div className="flex justify-start">
                    <div
                      className={cn(
                        "rounded-2xl rounded-tl-md px-4 py-3",
                        assistantBubbleClassName
                      )}
                    >
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
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                  setInput(e.target.value)
                }
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
  }
);