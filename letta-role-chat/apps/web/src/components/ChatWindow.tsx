import React, {
  useState,
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import { Role, Message } from "../types";
import { Send, Loader2, Plus, X, Code, ChevronDown, ChevronUp } from "lucide-react";
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
  base64: string;
}

interface CodeCard {
  id: string;
  language: string;
  code: string;
  collapsed: boolean;
}

const fileToBase64 = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

/** ✅ 修复正则：不要把正则拆成两行；支持 \r\n */
const CODE_BLOCK_RE = /```([\w+-]*)\r?\n([\s\S]*?)```/g;

const parseCodeBlocks = (text: string): { cards: CodeCard[]; plainText: string } => {
  const cards: CodeCard[] = [];
  let match: RegExpExecArray | null;
  let index = 0;

  CODE_BLOCK_RE.lastIndex = 0;
  while ((match = CODE_BLOCK_RE.exec(text)) !== null) {
    cards.push({
      id: `code-${index++}`,
      language: (match[1] || "code").trim() || "code",
      code: (match[2] ?? "").replace(/\s+$/, ""),
      collapsed: true,
    });
  }

  const plainText = text.replace(CODE_BLOCK_RE, "").trim();
  return { cards, plainText };
};

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
    const [inputCodeCards, setInputCodeCards] = useState<CodeCard[]>([]);

    const scrollRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [autoSpeak, setAutoSpeak] = useState(defaultAutoSpeak);
    const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});

    /** ✅ 稳定回调：给 MessageBubble 用（避免 map 内闭包） */
    const toggleExpanded = useCallback((id: string) => {
      setExpandedMap((prev) => ({ ...prev, [id]: !prev[id] }));
    }, []);

    useEffect(() => {
      const { cards } = parseCodeBlocks(input);
      setInputCodeCards(cards);
    }, [input]);

    useEffect(() => setAutoSpeak(defaultAutoSpeak), [defaultAutoSpeak]);

    const handleAutoSpeakChange = useCallback(
      (value: boolean) => {
        setAutoSpeak(value);
        onAutoSpeakChange?.(value);
      },
      [onAutoSpeakChange]
    );

    const { appendStream, flushStream, stop } = useTTS({
      voice: role?.voice,
      speed: role?.speed,
      pitch: role?.pitch,
      style: role?.style,
    });

    const clearHistory = useCallback(async () => {
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
    }, [role?.id]);

    useImperativeHandle(
      ref,
      () => ({
        toggleAutoSpeak: () => handleAutoSpeakChange(!autoSpeak),
        stopSpeak: stop,
        clearHistory,
      }),
      [stop, autoSpeak, handleAutoSpeakChange, clearHistory]
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

    /** ✅ 上传图片：并行 base64 */
    const handleImageUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = e.target.files;
      if (!files) return;

      const valid = Array.from(files).filter((file) => {
        if (!file.type.startsWith("image/")) {
          showWaifuMessage("请上传图片文件", 3000, 20, true);
          return false;
        }
        if (file.size > 10 * 1024 * 1024) {
          showWaifuMessage("图片大小不能超过 10MB", 3000, 20, true);
          return false;
        }
        return true;
      });

      const newImages: UploadedImage[] = await Promise.all(
        valid.map(async (file) => {
          const id = (globalThis.crypto?.randomUUID?.() ??
            `img-${Date.now()}-${Math.random()}`) as string;
          const preview = URL.createObjectURL(file);
          const base64 = await fileToBase64(file);
          return { id, file, preview, base64 };
        })
      );

      setUploadedImages((prev) => [...prev, ...newImages]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }, []);

    const removeImage = useCallback((id: string) => {
      setUploadedImages((prev) => {
        const img = prev.find((i) => i.id === id);
        if (img) URL.revokeObjectURL(img.preview);
        return prev.filter((i) => i.id !== id);
      });
    }, []);

    const toggleCodeCard = useCallback((cardId: string) => {
      setInputCodeCards((prev) =>
        prev.map((card) =>
          card.id === cardId ? { ...card, collapsed: !card.collapsed } : card
        )
      );
    }, []);

    /** ✅ O(1) 流式更新：更新最后一条 assistant，避免 filter 全数组 */
    const upsertAssistant = useCallback((assistantId: string, content: string) => {
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.id === assistantId) {
          return [...prev.slice(0, -1), { ...last, content, timestamp: Date.now() }];
        }
        return [
          ...prev,
          {
            id: assistantId,
            role: "assistant",
            content,
            timestamp: Date.now(),
          } as Message,
        ];
      });
    }, []);

    const handleSend = useCallback(async () => {
      if ((!input.trim() && uploadedImages.length === 0) || isLoading) return;

      const contentToSend = input.trim();
      const imagesToSend = [...uploadedImages];
      const base64Images = imagesToSend.map((img) => img.base64).filter(Boolean);

      const userMsg: Message = {
        id: "user-" + Date.now(),
        role: "user",
        content: contentToSend,
        timestamp: Date.now(),
        images: base64Images,
      };

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setUploadedImages([]);
      setInputCodeCards([]);
      setIsLoading(true);

      showWaifuMessage("让我想想…", 2000, 9, true);

      const assistantMsgId = "assistant-" + Date.now();
      let assistantContent = "";

      try {
        await api.sendMessageStream(
          role.id,
          contentToSend,
          (chunk: string) => {
            assistantContent += chunk;
            upsertAssistant(assistantMsgId, assistantContent);

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
            if (assistantContent.trim()) showWaifuMessage(brief || "已完成", 6000, 10, true);
            if (autoSpeak) await flushStream();
            imagesToSend.forEach((img) => URL.revokeObjectURL(img.preview));
          },
          base64Images
        );
      } catch (error) {
        console.error("Chat error:", error);
        setIsLoading(false);
        showWaifuMessage("好像出错了…要不要再试一次?", 5000, 20, true);
        imagesToSend.forEach((img) => URL.revokeObjectURL(img.preview));
      }
    }, [
      input,
      uploadedImages,
      isLoading,
      role.id,
      autoSpeak,
      appendStream,
      flushStream,
      upsertAssistant,
    ]);

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
                  type="button"
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
                  type="button"
                  onClick={stop}
                  className="text-xs px-2 py-1 rounded-md ring-1 ring-current/20 opacity-60 hover:opacity-100 transition"
                  title="Stop"
                >
                  停止
                </button>

                {/* ✅ 修复你原来 className 断裂/重复 */}
                <button
                  type="button"
                  onClick={clearHistory}
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
                  onToggleExpandedById={toggleExpanded}   // ✅ 核心：稳定回调
                  autoOpenLongCode={autoOpenLongCode}
                />
              ))}

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
            {/* 代码卡片预览 */}
            {inputCodeCards.length > 0 && (
              <div className="mb-3 space-y-2">
                {inputCodeCards.map((card) => (
                  <div
                    key={card.id}
                    className="rounded-lg border border-slate-700/50 bg-slate-800/50 overflow-hidden"
                  >
                    <button
                      type="button"
                      className="w-full flex items-center justify-between px-3 py-2 bg-slate-700/30 hover:bg-slate-700/50 transition text-left"
                      onClick={() => toggleCodeCard(card.id)}
                      aria-expanded={!card.collapsed ? "true" : "false"}
                      aria-label={`切换代码块 ${card.language || "code"} 展开/折叠`}
                    >
                      <div className="flex items-center gap-2 text-sm text-slate-300">
                        <Code size={14} />
                        <span>{card.language || "code"}</span>
                        <span className="text-xs text-slate-500">
                          ({card.code.split(/\r?\n/).length} 行)
                        </span>
                      </div>
                      {card.collapsed ? (
                        <ChevronDown size={16} className="text-slate-400" />
                      ) : (
                        <ChevronUp size={16} className="text-slate-400" />
                      )}
                    </button>

                    {!card.collapsed && (
                      <pre className="p-3 text-xs text-slate-200 overflow-x-auto max-h-48 overflow-y-auto">
                        <code>{card.code}</code>
                      </pre>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* 图片预览 */}
            {uploadedImages.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {uploadedImages.map((img) => (
                  <div
                    key={img.id}
                    className="relative group rounded-lg overflow-hidden border border-slate-700/50"
                  >
                    <img src={img.preview} alt="Upload preview" className="h-20 w-20 object-cover" />
                    <button
                      type="button"
                      onClick={() => removeImage(img.id)}
                      className="absolute top-1 right-1 p-1 rounded-full bg-slate-900/80 text-slate-100 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      title="删除图片"
                      aria-label="删除图片"
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
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="p-2 rounded-full hover:bg-slate-800/50 transition-colors text-slate-400 hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="上传图片"
                  aria-label="选择要上传的图片"
                >
                  <Plus size={20} />
                </button>
              </div>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
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
                  type="button"
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
                  aria-label="发送消息"
                >
                  {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
