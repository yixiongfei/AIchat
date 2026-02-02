import React, {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
} from "react";
import { Role, Message } from "../types";
import { Send, Loader2, Plus, X } from "lucide-react";
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
  autoOpenLongCode?: boolean;
}

export interface ChatWindowHandle {
  toggleAutoSpeak: () => void;
  stopSpeak: () => void;
  clearHistory: () => Promise<void>;
}

interface UploadedImage {
  id: string;
  file: File;
  preview: string;
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
    const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);

    const scrollRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [autoSpeak, setAutoSpeak] = useState(defaultAutoSpeak);
    const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});

    const toggleExpanded = (id: string) => {
      setExpandedMap((prev) => ({ ...prev, [id]: !prev[id] }));
    };

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

    useEffect(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, [messages]);

    useEffect(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.style.height = "auto";
      const newHeight = Math.min(Math.max(textarea.scrollHeight, 40), 120);
      textarea.style.height = `${newHeight}px`;
    }, [input]);

    useEffect(() => {
      return () => {
        clearWaifuTimers();
        stop();
        uploadedImages.forEach((img) => URL.revokeObjectURL(img.preview));
      };
    }, [stop, uploadedImages]);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      const newImages: UploadedImage[] = [];

      Array.from(files).forEach((file) => {
        if (!file.type.startsWith("image/")) {
          showWaifuMessage("请上传图片文件", 3000, 20, true);
          return;
        }
        if (file.size > 10 * 1024 * 1024) {
          showWaifuMessage("图片大小不能超过 10MB", 3000, 20, true);
          return;
        }

        const id = `img-${Date.now()}-${Math.random()}`;
        const preview = URL.createObjectURL(file);
        newImages.push({ id, file, preview });
      });

      setUploadedImages((prev) => [...prev, ...newImages]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    };

    const removeImage = (id: string) => {
      setUploadedImages((prev) => {
        const img = prev.find((i) => i.id === id);
        if (img) URL.revokeObjectURL(img.preview);
        return prev.filter((i) => i.id !== id);
      });
    };

    const handleSend = async () => {
      if ((!input.trim() && uploadedImages.length === 0) || isLoading) return;

      const contentToSend = input.trim();
      const imagesToSend = [...uploadedImages];

      const userMsg: Message = {
        id: "user-" + Date.now(),
        role: "user",
        content: contentToSend,
        timestamp: Date.now(),
        images: imagesToSend.map((img) => img.preview),
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setUploadedImages([]);
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
                filterCode: true,
              });
            }
          },
          async () => {
            setIsLoading(false);
            const brief = previewText(stripAllFencedCodes(assistantContent), 220);
            if (assistantContent.trim())
              showWaifuMessage(brief || "已完成", 6000, 10, true);
            if (autoSpeak) await flushStream();
            imagesToSend.forEach((img) => URL.revokeObjectURL(img.preview));
          }
        );
      } catch (error) {
        console.error("Chat error:", error);
        setIsLoading(false);
        showWaifuMessage("好像出错了…要不要再试一次?", 5000, 20, true);
        imagesToSend.forEach((img) => URL.revokeObjectURL(img.preview));
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
            {uploadedImages.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {uploadedImages.map((img) => (
                  <div
                    key={img.id}
                    className="relative group rounded-lg overflow-hidden border border-slate-700/50"
                  >
                    <img
                      src={img.preview}
                      alt="Upload preview"
                      className="h-20 w-20 object-cover"
                    />
                    <button
                      onClick={() => removeImage(img.id)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-slate-900/80 text-slate-100 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      title="删除图片"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}

            <div className={cn("relative flex items-end gap-2 rounded-2xl px-3 py-2", inputClassName)}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
                aria-label="上传图片"
              />
              <div className="flex items-center pb-2">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="p-2 rounded-full hover:bg-slate-800/50 transition-colors text-slate-400 hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="上传图片"
                >
                  <Plus size={20} />
                </button>
              </div>
              <textarea
                ref={textareaRef}
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
                className="flex-1 resize-none bg-transparent text-sm outline-none min-h-[40px] max-h-[120px] py-2 text-slate-100 placeholder:text-slate-400"
                style={{ height: "40px" }}
              />
              <div className="pb-2">
                <button
                  onClick={handleSend}
                  disabled={isLoading || (!input.trim() && uploadedImages.length === 0)}
                  className={cn(
                    "p-2.5 rounded-full inline-flex items-center justify-center transition-all",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    sendButtonClassName,
                    (!input.trim() && uploadedImages.length === 0) || isLoading
                      ? "opacity-50"
                      : "hover:scale-105"
                  )}
                  title="发送"
                >
                  {isLoading ? (
                    <Loader2 size={20} className="animate-spin" />
                  ) : (
                    <Send size={20} />
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);