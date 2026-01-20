
import React, { useState, useRef, useEffect } from "react";
import { Role, Message } from "../types";
import { Send, Loader2 } from "lucide-react";
import { api } from "../services/api";
import { showWaifuMessage, showWaifuStreamUpdate, clearWaifuTimers } from "../utils/live2dBridge";

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

interface ChatWindowProps {
  role: Role;

  /** ✅ 把样式控制交给 App：以下全是可选注入 */
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;            // scroll 外层
  bodyInnerClassName?: string;       // scroll 内层（用来做“居中列”）
  inputBarClassName?: string;
  inputClassName?: string;
  sendButtonClassName?: string;

  userBubbleClassName?: string;
  assistantBubbleClassName?: string;

  /** 是否显示顶部栏（如果你想把 header 放到 App 里，就关掉） */
  showHeader?: boolean;
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
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

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

  // 组件卸载清理（避免定时器泄漏）
  useEffect(() => {
    return () => clearWaifuTimers();
  }, []);

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
        },
        () => {
          setIsLoading(false);
          if (assistantContent.trim()) {
            showWaifuMessage(assistantContent, 8000, 10, true);
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
      {/* 顶部栏：可选 */}
      {showHeader && (
        <div className={cn("shrink-0 px-4 py-3", headerClassName)}>
          <div className="flex items-center justify-between">
            <div className="min-w-0">
              <div className="font-semibold truncate">{role.name}</div>
              <div className="text-xs opacity-70">Online</div>
            </div>
            <div className="text-xs opacity-60">{messages.length} msgs</div>
          </div>
        </div>
      )}

      {/* 消息区：外层负责滚动；内层负责“居中列” */}
      <div
        ref={scrollRef}
        className={cn("flex-1 overflow-y-auto px-4 py-4", bodyClassName)}
      >
        <div
          className={cn(
            "mx-auto w-full max-w-3xl space-y-4", // ✅ 居中列（像图二）
            bodyInnerClassName
          )}
        >
          {messages.map((msg) => {
            const isUser = msg.role === "user";

            return (
              <div key={msg.id} className={cn("flex", isUser ? "justify-end" : "justify-start")}>
                <div
                  className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    isUser ? cn("rounded-tr-md", userBubbleClassName) : cn("rounded-tl-md", assistantBubbleClassName)
                  )}
                >
                  <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                </div>
              </div>
            );
          })}

          {/* loading（只在尚未生成 assistant 气泡时显示） */}
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

      {/* 输入栏：更大，像图二。用 textarea 更舒服 */}
      <div className={cn("shrink-0 px-4 py-4", inputBarClassName)}>
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              // Enter 发送，Shift+Enter 换行
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={`Message ${role.name}...`}
            rows={2}
            className={cn(
              "flex-1 resize-none rounded-2xl px-4 py-3 text-sm outline-none",
              "min-h-[56px] max-h-[160px]", // ✅ 输入框放大（像图二）
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
