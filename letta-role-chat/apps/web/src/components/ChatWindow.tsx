
import React, { useState, useRef, useEffect } from "react";
import { Role, Message } from "../types";
import { Send, Loader2 } from "lucide-react";
import { api } from "../services/api";
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

  /** ✅ TTS：当前音频元素 */
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const currentAudioFileRef = useRef<string | null>(null);

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
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    if (currentAudioFileRef.current) {
      const fileName = currentAudioFileRef.current;
      currentAudioFileRef.current = null;
      try {
        await api.deleteAudio(fileName);
      } catch (e) {
        console.error("Failed to delete audio file:", e);
      }
    }
  };

  // =========================
  // ✅ TTS：调用后端 TTS 并播放
  // =========================
  async function playTTS(message: string) {
    try {
      // 1. 先停止之前的播放
      await stopSpeak();

      // 2. 请求后端生成语音
      const resp = await fetch("/api/tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          message,
          voice: role.voice,
          speed: role.speed,
          pitch: role.pitch,
          style: role.style
        }),
      });

      if (!resp.ok) throw new Error("TTS request failed");
      
      const { fileName } = await resp.json();
      currentAudioFileRef.current = fileName;

      // 3. 播放音频
      const audioUrl = `/api/tts/audio/${fileName}`;
      const audio = new Audio(audioUrl);
      audioRef.current = audio;
      
      audio.onended = () => {
        stopSpeak(); // 播放完自动删除
      };

      await audio.play();
    } catch (error) {
      console.error("TTS Play Error:", error);
    }
  }

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
        },
        async () => {
          setIsLoading(false);

          if (assistantContent.trim()) {
            showWaifuMessage(assistantContent, 8000, 10, true);

            // ✅ 流式结束后朗读
            if (autoSpeak) {
              await playTTS(assistantContent);
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
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
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
