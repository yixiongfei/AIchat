// src/components/MessageBubble.tsx
import React, { useMemo, useState, useCallback } from "react";
import { Message, Role } from "../types";
import AssistantMessageContent from "./AssistantMessageContent";
import { Code, ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import {
  DEFAULT_THRESHOLDS,
  previewText,
  stripAllFencedCodes,
} from "../utils/codeSegmentation";

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

/**
 * 更稳的 fenced code block 正则：
 * - 支持 ```lang\ncode```、``` \ncode```、Windows \r\n
 * - 语言名支持 + -（如 c++、objective-c、ts-js）
 */
const CODE_BLOCK_RE = /```([\w+-]*)\r?\n([\s\S]*?)```/g;

function shouldCollapseMessage(text: string) {
  const nonCodeLen = stripAllFencedCodes(text).length;
  const collapse = nonCodeLen >= DEFAULT_THRESHOLDS.TEXT_CHAR_THRESHOLD;
  return { collapse, nonCodeLen };
}

/** 判断消息是否为"长回复"，需要拓宽显示 */
function isLongMessage(text: string): boolean {
  // 判断条件：
  // 1. 包含代码块
  // 2. 或文本长度超过 300 字符
  // 3. 或超过 5 行
  const hasCodeBlock = /```[\s\S]*?```/.test(text);
  const lineCount = text.split(/\r?\n/).length;
  const textLength = stripAllFencedCodes(text).length;
  
  return hasCodeBlock || textLength > 300 || lineCount > 5;
}

type ParsedSegment =
  | { type: "text"; content: string }
  | { type: "code"; content: string; language: string };

function parseMessageContent(text: string): ParsedSegment[] {
  const segments: ParsedSegment[] = [];
  let lastIndex = 0;

  CODE_BLOCK_RE.lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = CODE_BLOCK_RE.exec(text)) !== null) {
    const [full, langRaw, codeRaw] = match;
    const start = match.index;

    // 保留原文本，不 trim
    if (start > lastIndex) {
      const before = text.slice(lastIndex, start);
      if (before.length > 0) segments.push({ type: "text", content: before });
    }

    const language = (langRaw || "code").trim() || "code";
    // 只去掉尾部多余空白，保留缩进/换行
    const code = (codeRaw ?? "").replace(/\s+$/, "");
    segments.push({ type: "code", language, content: code });

    lastIndex = start + full.length;
  }

  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex);
    if (remaining.length > 0) segments.push({ type: "text", content: remaining });
  }

  return segments.length ? segments : [{ type: "text", content: text }];
}

const UserCodeCard = React.memo(function UserCodeCard({
  language,
  code,
}: {
  language: string;
  code: string;
}) {
  const [collapsed, setCollapsed] = useState(true);

  const lineCount = useMemo(() => (code ? code.split(/\r?\n/).length : 0), [code]);

  const toggle = useCallback(() => setCollapsed((v) => !v), []);

  return (
    <div className="my-2 rounded-lg border overflow-hidden border-slate-300 bg-slate-100 dark:border-slate-600/50 dark:bg-slate-700/30">
      <button
        type="button"
        className="w-full flex items-center justify-between px-3 py-2 transition text-left bg-slate-200/50 hover:bg-slate-200 dark:bg-slate-600/30 dark:hover:bg-slate-600/50"
        onClick={toggle}
        aria-expanded={!collapsed ? "true" : "false"} 
        aria-label={`切换代码块 ${language} 展开/折叠`}
      >
        <div className="flex items-center gap-2 text-base text-slate-700 dark:text-slate-200">
          <Code size={14} />
          <span>{language}</span>
          <span className="text-xs text-slate-500 dark:text-slate-400">({lineCount} 行)</span>
        </div>
        {collapsed ? (
          <ChevronDown size={16} className="text-slate-600 dark:text-slate-300" />
        ) : (
          <ChevronUp size={16} className="text-slate-600 dark:text-slate-300" />
        )}
      </button>

      {!collapsed && (
        <pre className="p-3 text-sm overflow-x-auto max-h-64 overflow-y-auto text-slate-800 bg-slate-50 dark:text-slate-100 dark:bg-slate-800/50">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
});

const UserMessageContent = React.memo(function UserMessageContent({
  content,
}: {
  content: string;
}) {
  const segments = useMemo(() => parseMessageContent(content), [content]);
  const hasCode = useMemo(() => segments.some((s) => s.type === "code"), [segments]);

  if (!hasCode) {
    return <p className="whitespace-pre-wrap break-words">{content}</p>;
  }

  return (
    <div className="space-y-1">
      {segments.map((segment, index) => {
        if (segment.type === "text") {
          return (
            <p key={`t-${index}`} className="whitespace-pre-wrap break-words">
              {segment.content}
            </p>
          );
        }
        return (
          <UserCodeCard
            key={`c-${index}`}
            language={segment.language || "code"}
            code={segment.content}
          />
        );
      })}
    </div>
  );
});

export default React.memo(function MessageBubble(props: {
  msg: Message;
  role: Role;
  userBubbleClassName?: string;
  assistantBubbleClassName?: string;
  expanded: boolean;

  // ✅ 优化：传稳定函数，避免 map 中为每条消息创建闭包
  onToggleExpandedById: (id: string) => void;

  autoOpenLongCode?: boolean;
  
  // ✅ 删除消息回调
  onDelete?: (messageId: string) => void;
}) {
  const {
    msg,
    role,
    userBubbleClassName,
    assistantBubbleClassName,
    expanded,
    onToggleExpandedById,
    autoOpenLongCode = true,
    onDelete,
  } = props;

  const isUser = msg.role === "user";

  const { collapse, nonCodeLen } = useMemo(
    () => shouldCollapseMessage(msg.content),
    [msg.content]
  );

  // ✅ 删除消息处理函数
  const handleDelete = useCallback(() => {
    if (!onDelete) return;
    onDelete(msg.id);
  }, [onDelete, msg.id]);

  // ✅ 判断是否为长消息，长消息 AI 回复需要拓宽
  const isLong = useMemo(() => isLongMessage(msg.content), [msg.content]);

  const collapsedPreview = useMemo(() => {
    if (!collapse) return "";
    return previewText(stripAllFencedCodes(msg.content), 260);
  }, [collapse, msg.content]);

  // ✅ 内部生成回调：只随 msg.id 变化
  const onToggle = useCallback(() => {
    onToggleExpandedById(msg.id);
  }, [onToggleExpandedById, msg.id]);

  const contentNode = useMemo(() => {
    if (!collapse) {
      return isUser ? (
        <UserMessageContent content={msg.content} />
      ) : (
        <AssistantMessageContent
          msgId={msg.id}
          roleName={role.name}
          text={msg.content}
          autoOpenLongCode={autoOpenLongCode}
        />
      );
    }

    return (
      <div className="w-full">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="text-xs text-slate-600 dark:text-slate-300/80">
            长消息 · {nonCodeLen} 字符（不含代码）
          </div>
          <button
            type="button"
            onClick={onToggle}
            className="text-xs px-2 py-1 rounded-md transition bg-slate-200 hover:bg-slate-300 ring-1 ring-slate-300 dark:bg-slate-800/50 dark:hover:bg-slate-800 dark:ring-white/10"
            aria-expanded={expanded ? "true" : "false"}  // ✅ axe 100% 通过
          >
            {expanded ? "收起" : "展开"}
          </button>
        </div>

        {!expanded ? (
          <div className="text-base whitespace-pre-wrap break-words text-slate-700 dark:text-slate-200/90">
            {collapsedPreview}
          </div>
        ) : isUser ? (
          <UserMessageContent content={msg.content} />
        ) : (
          <AssistantMessageContent
            msgId={msg.id}
            roleName={role.name}
            text={msg.content}
            autoOpenLongCode={autoOpenLongCode}
          />
        )}
      </div>
    );
  }, [
    collapse,
    isUser,
    msg.content,
    msg.id,
    role.name,
    autoOpenLongCode,
    expanded,
    collapsedPreview,
    nonCodeLen,
    onToggle,
  ]);

  return (
    <div className={cn("flex group", isUser ? "justify-end" : "justify-start")}>
      <div
        className={cn(
          "relative rounded-2xl px-4 py-3 text-base leading-relaxed",
          // ✅ 动态宽度：
          // - 用户消息：保持 max-w-[80%]
          // - AI 短回复：max-w-[80%]
          // - AI 长回复（含代码/长文本）：w-full 无限制
          isUser
            ? "max-w-[80%]"
            : isLong
              ? "w-full"  // 长回复：拓宽到容器宽度
              : "max-w-[80%]",  // 短回复：保持限制
          isUser
            ? cn("rounded-tr-md", userBubbleClassName)
            : cn("rounded-tl-md", assistantBubbleClassName)
        )}
      >
        {/* ✅ 删除按钮：鼠标悬停时显示 */}
        {onDelete && (
          <button
            type="button"
            onClick={handleDelete}
            className="absolute -top-2 -right-2 p-1.5 rounded-full bg-red-500 text-white opacity-0 group-hover:opacity-100 transition-opacity shadow-md hover:bg-red-600 hover:scale-110"
            title="删除消息"
            aria-label="删除消息"
          >
            <Trash2 size={14} />
          </button>
        )}

        {/* 图片 */}
        {msg.images && msg.images.length > 0 && (
          <div className="mb-2 grid grid-cols-2 gap-2 max-w-md">
            {msg.images.map((imageUrl, index) => (
              <a
                key={`${msg.id}-img-${index}`}
                href={imageUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="relative rounded-lg overflow-hidden border border-slate-700/50 hover:border-slate-600 transition-colors cursor-pointer"
                aria-label={`打开图片 ${index + 1}`}
              >
                <img
                  src={imageUrl}
                  alt={`Uploaded image ${index + 1}`}
                  className="w-full h-auto object-cover"
                  loading="lazy"
                  decoding="async"
                />
              </a>
            ))}
          </div>
        )}

        {contentNode}
      </div>
    </div>
  );
});
