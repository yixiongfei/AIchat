import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Role, Message } from "../types";
import { api } from "../services/api";
import useTTS from "../hooks/useTTS";
import {
  showWaifuMessage,
  showWaifuStreamUpdate,
  clearWaifuTimers,
} from "../utils/live2dBridge";
import { previewText, stripAllFencedCodes } from "../utils/codeSegmentation";

/** 上传图片模型 */
export interface UploadedImage {
  id: string;
  file: File;
  preview: string; // objectURL
  base64: string;  // dataURL
}

/** 文本附件模型（长文本粘贴自动生成，发送时才传给后端） */
export interface TextAttachment {
  id: string;
  fileName: string;
  content: string;      // 原始文本内容
  charCount: number;    // 字符数
  lineCount: number;    // 行数
}

/** 输入框代码卡片（解析自 input） */
export interface CodeCard {
  id: string;
  language: string;
  code: string;
}

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

const CODE_BLOCK_RE = /```(\w*)\n([\s\S]*?)```/g;

/** 长文本粘贴阈值 */
export const PASTE_TEXT_THRESHOLD = {
  CHAR_COUNT: 2000,   // 超过 2000 字符转附件
  LINE_COUNT: 50,     // 或超过 50 行转附件
};

/** 生成时间戳文件名 */
function generateTextFileName(): string {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `paste-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.txt`;
}

/** 判断文本是否应转为附件 */
export function shouldConvertToAttachment(text: string): boolean {
  if (!text) return false;
  const charCount = text.length;
  const lineCount = text.split(/\r?\n/).length;
  return charCount >= PASTE_TEXT_THRESHOLD.CHAR_COUNT || lineCount >= PASTE_TEXT_THRESHOLD.LINE_COUNT;
}

function parseCodeBlocks(text: string): { cards: CodeCard[]; plainText: string } {
  const cards: CodeCard[] = [];
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = CODE_BLOCK_RE.exec(text)) !== null) {
    cards.push({
      id: `code-${idx++}`,
      language: match[1] || "code",
      code: (match[2] ?? "").trim(),
    });
  }

  const plainText = text.replace(CODE_BLOCK_RE, "").trim();
  return { cards, plainText };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export interface UseChatStreamOptions {
  role: Role;
  defaultAutoSpeak?: boolean;
  onAutoSpeakChange?: (value: boolean) => void;
  autoOpenLongCode?: boolean; // 这里不直接用，但保留给上层
}

export function useChatStream({
  role,
  defaultAutoSpeak = false,
  onAutoSpeakChange,
}: UseChatStreamOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const [uploadedImages, setUploadedImages] = useState<UploadedImage[]>([]);
  const [textAttachments, setTextAttachments] = useState<TextAttachment[]>([]);
  const [autoSpeak, setAutoSpeak] = useState(defaultAutoSpeak);

  // MessageBubble 代码展开（历史消息）
  const [expandedMap, setExpandedMap] = useState<Record<string, boolean>>({});

  // 输入代码卡片折叠状态
  const [collapsedMap, setCollapsedMap] = useState<Record<string, boolean>>({});

  // refs
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 滚动/容器引用交给 ChatWindow 管
  // 这里提供取消能力：用 requestId 让旧请求 chunk 自动失效
  const activeRequestIdRef = useRef<string>("");

  const { appendStream, flushStream, stop: stopSpeak } = useTTS({
    voice: role?.voice,
    speed: role?.speed,
    pitch: role?.pitch,
    style: role?.style,
  });

  useEffect(() => {
    setAutoSpeak(defaultAutoSpeak);
  }, [defaultAutoSpeak]);

  const handleAutoSpeakChange = useCallback(
    (value: boolean) => {
      setAutoSpeak(value);
      onAutoSpeakChange?.(value);
    },
    [onAutoSpeakChange]
  );

  // 解析输入（派生数据用 useMemo，避免反复 setState）
  const parsedInput = useMemo(() => parseCodeBlocks(input), [input]);
  const inputCodeCards = parsedInput.cards;

  // 维护折叠状态：新卡默认 collapsed=true，旧状态保留；消失的卡清掉
  useEffect(() => {
    setCollapsedMap((prev) => {
      const next = { ...prev };
      for (const c of inputCodeCards) {
        if (next[c.id] === undefined) next[c.id] = true;
      }
      Object.keys(next).forEach((k) => {
        if (!inputCodeCards.some((c) => c.id === k)) delete next[k];
      });
      return next;
    });
  }, [inputCodeCards]);

  const toggleCodeCard = useCallback((id: string) => {
    setCollapsedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  const toggleExpanded = useCallback((id: string) => {
    setExpandedMap((prev) => ({ ...prev, [id]: !prev[id] }));
  }, []);

  // 加载历史
  useEffect(() => {
    let mounted = true;
    const loadHistory = async () => {
      try {
        const history = await api.getHistory(role.id);
        if (mounted) setMessages(history);
      } catch (e) {
        console.error("Failed to load history:", e);
      }
    };
    setMessages([]);
    loadHistory();
    return () => {
      mounted = false;
    };
  }, [role.id]);

  // 卸载清理
  useEffect(() => {
    return () => {
      clearWaifuTimers();
      stopSpeak();
      // 清理 objectURL
      uploadedImages.forEach((img) => URL.revokeObjectURL(img.preview));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** 打开文件选择框 */
  const openFileDialog = useCallback(() => {
    fileInputRef.current?.click();
  }, []);

  /** 上传图片（并行 base64，性能更好） */
  const handleImageUpload = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
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
          const id =
            (globalThis.crypto?.randomUUID?.() ??
              `img-${Date.now()}-${Math.random()}`) as string;
          const preview = URL.createObjectURL(file);
          const base64 = await fileToBase64(file);
          return { id, file, preview, base64 };
        })
      );

      setUploadedImages((prev) => [...prev, ...newImages]);
      if (fileInputRef.current) fileInputRef.current.value = "";
    },
    []
  );

  /** 删除图片 */
  const removeImage = useCallback((id: string) => {
    setUploadedImages((prev) => {
      const img = prev.find((i) => i.id === id);
      if (img) URL.revokeObjectURL(img.preview);
      return prev.filter((i) => i.id !== id);
    });
  }, []);

  /** 清空图片（用于发送后） */
  const clearImages = useCallback(() => {
    setUploadedImages((prev) => {
      prev.forEach((img) => URL.revokeObjectURL(img.preview));
      return [];
    });
  }, []);

  /** 处理长文本粘贴 -> 前端存储为附件（发送时才传给后端） */
  const handlePastedText = useCallback((text: string) => {
    if (!shouldConvertToAttachment(text)) return false;

    const id = globalThis.crypto?.randomUUID?.() ?? `txt-${Date.now()}-${Math.random()}`;
    const fileName = generateTextFileName();
    const lineCount = text.split(/\r?\n/).length;

    const attachment: TextAttachment = {
      id,
      fileName,
      content: text,
      charCount: text.length,
      lineCount,
    };

    setTextAttachments((prev) => [...prev, attachment]);
    showWaifuMessage(`已添加文本附件 (${lineCount} 行, ${text.length} 字符)`, 2000, 10, true);

    return true; // 表示已处理
  }, []);

  /** 删除文本附件 */
  const removeTextAttachment = useCallback((id: string) => {
    setTextAttachments((prev) => prev.filter((a) => a.id !== id));
  }, []);

  /** 清空文本附件（用于发送后） */
  const clearTextAttachments = useCallback(() => {
    setTextAttachments([]);
  }, []);

  /** O(1) 更新最后一条 assistant 消息（避免每 chunk filter 全量数组） */
  const upsertAssistantMessage = useCallback((id: string, content: string) => {
    setMessages((prev) => {
      const last = prev[prev.length - 1];
      if (last && last.id === id) {
        return [...prev.slice(0, -1), { ...last, content, timestamp: Date.now() }];
      }
      return [
        ...prev,
        {
          id,
          role: "assistant",
          content,
          timestamp: Date.now(),
        } as Message,
      ];
    });
  }, []);

  /** 取消流式（本实现通过 requestId 让后续 chunk 失效） */
  const cancelStream = useCallback(() => {
    activeRequestIdRef.current = "";
    setIsLoading(false);
    stopSpeak();
    showWaifuMessage("已停止生成", 2000, 20, true);
  }, [stopSpeak]);

  /** 清空历史 */
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

  /** 发送消息（含图片 base64 和文本附件） */
  const send = useCallback(async () => {
    const hasTextAttachments = textAttachments.length > 0;
    if ((!input.trim() && uploadedImages.length === 0 && !hasTextAttachments) || isLoading) return;

    const contentToSend = input.trim();
    const imagesToSend = [...uploadedImages];
    const base64Images = imagesToSend.map((img) => img.base64).filter(Boolean);

    // 收集文本附件（内容直接发送，不需要预上传）
    const attachmentInfos = textAttachments.map((a) => ({
      fileName: a.fileName,
      content: a.content,   // 直接带上内容
      charCount: a.charCount,
      lineCount: a.lineCount,
    }));

    // 构建显示的消息内容（如果有附件，添加占位符）
    let displayContent = contentToSend;
    if (attachmentInfos.length > 0) {
      const attachmentNotes = attachmentInfos
        .map((a) => `[附件: ${a.fileName} (${a.lineCount} 行, ${a.charCount} 字符)]`)
        .join('\n');
      displayContent = displayContent
        ? `${displayContent}\n\n${attachmentNotes}`
        : attachmentNotes;
    }

    // 用户消息：图片用 base64（dataURL）便于持久/展示
    const userMsg: Message = {
      id: "user-" + Date.now(),
      role: "user",
      content: displayContent,
      timestamp: Date.now(),
      images: base64Images,
      attachments: attachmentInfos.length > 0 ? attachmentInfos : undefined,
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setIsLoading(true);
    clearImages(); // 发送后立即清掉预览（并释放 objectURL）
    clearTextAttachments(); // 清空文本附件

    showWaifuMessage("让我想想…", 2000, 9, true);

    const requestId = "req-" + Date.now();
    activeRequestIdRef.current = requestId;

    const assistantMsgId = "assistant-" + Date.now();
    let assistantContent = "";

    try {
      await api.sendMessageStream(
        role.id,
        contentToSend,
        (chunk: string) => {
          // 如果已取消或被新请求替换，忽略
          if (activeRequestIdRef.current !== requestId) return;

          assistantContent += chunk;
          upsertAssistantMessage(assistantMsgId, assistantContent);

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
          if (activeRequestIdRef.current !== requestId) return;

          setIsLoading(false);
          activeRequestIdRef.current = "";

          const brief = previewText(stripAllFencedCodes(assistantContent), 220);
          if (assistantContent.trim()) showWaifuMessage(brief || "已完成", 6000, 10, true);

          if (autoSpeak) await flushStream();
        },
        base64Images,
        attachmentInfos.length > 0 ? attachmentInfos : undefined
      );
    } catch (e) {
      console.error("Chat error:", e);
      if (activeRequestIdRef.current === requestId) {
        setIsLoading(false);
        activeRequestIdRef.current = "";
      }
      showWaifuMessage("好像出错了…要不要再试一次?", 5000, 20, true);
    }
  }, [
    input,
    uploadedImages,
    textAttachments,
    isLoading,
    role.id,
    autoSpeak,
    appendStream,
    flushStream,
    upsertAssistantMessage,
    clearImages,
    clearTextAttachments,
  ]);

  return {
    // state
    messages,
    setMessages,
    input,
    setInput,
    isLoading,
    autoSpeak,
    uploadedImages,
    textAttachments,

    // code preview
    inputCodeCards,
    collapsedMap,
    toggleCodeCard,

    // message expand
    expandedMap,
    toggleExpanded,

    // actions
    send,
    cancelStream,
    stopSpeak,
    clearHistory,
    handleAutoSpeakChange,

    // upload
    fileInputRef,
    openFileDialog,
    handleImageUpload,
    removeImage,

    // text attachments
    handlePastedText,
    removeTextAttachment,

    // helpers
    cn,
  };
}