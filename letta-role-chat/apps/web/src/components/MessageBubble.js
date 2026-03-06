import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// src/components/MessageBubble.tsx
import React, { useMemo, useState, useCallback } from "react";
import AssistantMessageContent from "./AssistantMessageContent";
import { Code, ChevronDown, ChevronUp, Trash2, Copy, Check } from "lucide-react";
import { DEFAULT_THRESHOLDS, previewText, stripAllFencedCodes, } from "../utils/codeSegmentation";
const cn = (...classes) => classes.filter(Boolean).join(" ");
/** 相对时间显示 */
function relativeTime(ts) {
    const diff = Date.now() - ts;
    const sec = Math.floor(diff / 1000);
    if (sec < 60)
        return "刚刚";
    const min = Math.floor(sec / 60);
    if (min < 60)
        return `${min}分钟前`;
    const hr = Math.floor(min / 60);
    if (hr < 24)
        return `${hr}小时前`;
    const day = Math.floor(hr / 24);
    if (day < 30)
        return `${day}天前`;
    // 超过 30 天显示日期
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()}`;
}
/**
 * 更稳的 fenced code block 正则：
 * - 支持 ```lang\ncode```、``` \ncode```、Windows \r\n
 * - 语言名支持 + -（如 c++、objective-c、ts-js）
 */
const CODE_BLOCK_RE = /```([\w+-]*)\r?\n([\s\S]*?)```/g;
function shouldCollapseMessage(text) {
    const nonCodeLen = stripAllFencedCodes(text).length;
    const collapse = nonCodeLen >= DEFAULT_THRESHOLDS.TEXT_CHAR_THRESHOLD;
    return { collapse, nonCodeLen };
}
/** 判断消息是否为"长回复"，需要拓宽显示 */
function isLongMessage(text) {
    // 判断条件：
    // 1. 包含代码块
    // 2. 或文本长度超过 300 字符
    // 3. 或超过 5 行
    const hasCodeBlock = /```[\s\S]*?```/.test(text);
    const lineCount = text.split(/\r?\n/).length;
    const textLength = stripAllFencedCodes(text).length;
    return hasCodeBlock || textLength > 300 || lineCount > 5;
}
function parseMessageContent(text) {
    const segments = [];
    let lastIndex = 0;
    CODE_BLOCK_RE.lastIndex = 0;
    let match;
    while ((match = CODE_BLOCK_RE.exec(text)) !== null) {
        const [full, langRaw, codeRaw] = match;
        const start = match.index;
        // 保留原文本，不 trim
        if (start > lastIndex) {
            const before = text.slice(lastIndex, start);
            if (before.length > 0)
                segments.push({ type: "text", content: before });
        }
        const language = (langRaw || "code").trim() || "code";
        // 只去掉尾部多余空白，保留缩进/换行
        const code = (codeRaw ?? "").replace(/\s+$/, "");
        segments.push({ type: "code", language, content: code });
        lastIndex = start + full.length;
    }
    if (lastIndex < text.length) {
        const remaining = text.slice(lastIndex);
        if (remaining.length > 0)
            segments.push({ type: "text", content: remaining });
    }
    return segments.length ? segments : [{ type: "text", content: text }];
}
const UserCodeCard = React.memo(function UserCodeCard({ language, code, }) {
    const [collapsed, setCollapsed] = useState(true);
    const lineCount = useMemo(() => (code ? code.split(/\r?\n/).length : 0), [code]);
    const toggle = useCallback(() => setCollapsed((v) => !v), []);
    return (_jsxs("div", { className: "my-2 rounded-lg border overflow-hidden border-slate-300 bg-slate-100 dark:border-slate-600/50 dark:bg-slate-700/30", children: [_jsxs("button", { type: "button", className: "w-full flex items-center justify-between px-3 py-2 transition text-left bg-slate-200/50 hover:bg-slate-200 dark:bg-slate-600/30 dark:hover:bg-slate-600/50", onClick: toggle, "aria-expanded": !collapsed ? "true" : "false", "aria-label": `切换代码块 ${language} 展开/折叠`, children: [_jsxs("div", { className: "flex items-center gap-2 text-base text-slate-700 dark:text-slate-200", children: [_jsx(Code, { size: 14 }), _jsx("span", { children: language }), _jsxs("span", { className: "text-xs text-slate-500 dark:text-slate-400", children: ["(", lineCount, " \u884C)"] })] }), collapsed ? (_jsx(ChevronDown, { size: 16, className: "text-slate-600 dark:text-slate-300" })) : (_jsx(ChevronUp, { size: 16, className: "text-slate-600 dark:text-slate-300" }))] }), !collapsed && (_jsx("pre", { className: "p-3 text-sm overflow-x-auto max-h-64 overflow-y-auto text-slate-800 bg-slate-50 dark:text-slate-100 dark:bg-slate-800/50", children: _jsx("code", { children: code }) }))] }));
});
const UserMessageContent = React.memo(function UserMessageContent({ content, }) {
    const segments = useMemo(() => parseMessageContent(content), [content]);
    const hasCode = useMemo(() => segments.some((s) => s.type === "code"), [segments]);
    if (!hasCode) {
        return _jsx("p", { className: "whitespace-pre-wrap break-words", children: content });
    }
    return (_jsx("div", { className: "space-y-1", children: segments.map((segment, index) => {
            if (segment.type === "text") {
                return (_jsx("p", { className: "whitespace-pre-wrap break-words", children: segment.content }, `t-${index}`));
            }
            return (_jsx(UserCodeCard, { language: segment.language || "code", code: segment.content }, `c-${index}`));
        }) }));
});
export default React.memo(function MessageBubble(props) {
    const { msg, role, userBubbleClassName, assistantBubbleClassName, expanded, onToggleExpandedById, autoOpenLongCode = true, onDelete, } = props;
    const isUser = msg.role === "user";
    const { collapse, nonCodeLen } = useMemo(() => shouldCollapseMessage(msg.content), [msg.content]);
    // ✅ 删除消息处理函数
    const handleDelete = useCallback(() => {
        if (!onDelete)
            return;
        onDelete(msg.id);
    }, [onDelete, msg.id]);
    // ✅ 复制消息处理函数
    const [copied, setCopied] = useState(false);
    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(msg.content);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
        catch {
            const ta = document.createElement("textarea");
            ta.value = msg.content;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }, [msg.content]);
    // ✅ 判断是否为长消息，长消息 AI 回复需要拓宽
    const isLong = useMemo(() => isLongMessage(msg.content), [msg.content]);
    const collapsedPreview = useMemo(() => {
        if (!collapse)
            return "";
        return previewText(stripAllFencedCodes(msg.content), 260);
    }, [collapse, msg.content]);
    // ✅ 内部生成回调：只随 msg.id 变化
    const onToggle = useCallback(() => {
        onToggleExpandedById(msg.id);
    }, [onToggleExpandedById, msg.id]);
    const contentNode = useMemo(() => {
        if (!collapse) {
            return isUser ? (_jsx(UserMessageContent, { content: msg.content })) : (_jsx(AssistantMessageContent, { msgId: msg.id, roleName: role.name, text: msg.content, autoOpenLongCode: autoOpenLongCode }));
        }
        return (_jsxs("div", { className: "w-full", children: [_jsxs("div", { className: "flex items-center justify-between gap-2 mb-2", children: [_jsxs("div", { className: "text-xs text-slate-600 dark:text-slate-300/80", children: ["\u957F\u6D88\u606F \u00B7 ", nonCodeLen, " \u5B57\u7B26\uFF08\u4E0D\u542B\u4EE3\u7801\uFF09"] }), _jsx("button", { type: "button", onClick: onToggle, className: "text-xs px-2 py-1 rounded-md transition bg-slate-200 hover:bg-slate-300 ring-1 ring-slate-300 dark:bg-slate-800/50 dark:hover:bg-slate-800 dark:ring-white/10", "aria-expanded": expanded ? "true" : "false", children: expanded ? "收起" : "展开" })] }), !expanded ? (_jsx("div", { className: "text-base whitespace-pre-wrap break-words text-slate-700 dark:text-slate-200/90", children: collapsedPreview })) : isUser ? (_jsx(UserMessageContent, { content: msg.content })) : (_jsx(AssistantMessageContent, { msgId: msg.id, roleName: role.name, text: msg.content, autoOpenLongCode: autoOpenLongCode }))] }));
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
    return (_jsxs("div", { className: cn("group", isUser ? "flex flex-col items-end" : "flex flex-col items-start"), children: [_jsxs("div", { className: cn("relative rounded-2xl px-4 py-3 text-base leading-relaxed", 
                // ✅ 动态宽度：
                // - 用户消息：保持 max-w-[80%]
                // - AI 短回复：max-w-[80%]
                // - AI 长回复（含代码/长文本）：w-full 无限制
                isUser
                    ? "max-w-[80%]"
                    : isLong
                        ? "w-full" // 长回复：拓宽到容器宽度
                        : "max-w-[80%]", // 短回复：保持限制
                isUser
                    ? cn("rounded-tr-md", userBubbleClassName)
                    : cn("rounded-tl-md", assistantBubbleClassName)), children: [msg.images && msg.images.length > 0 && (_jsx("div", { className: "mb-2 grid grid-cols-2 gap-2 max-w-md", children: msg.images.map((imageUrl, index) => (_jsx("a", { href: imageUrl, target: "_blank", rel: "noreferrer noopener", className: "relative rounded-lg overflow-hidden border border-slate-700/50 hover:border-slate-600 transition-colors cursor-pointer", "aria-label": `打开图片 ${index + 1}`, children: _jsx("img", { src: imageUrl, alt: `Uploaded image ${index + 1}`, className: "w-full h-auto object-cover", loading: "lazy", decoding: "async" }) }, `${msg.id}-img-${index}`))) })), contentNode] }), _jsxs("div", { className: cn("flex items-center gap-1.5 mt-1 h-6 opacity-0 group-hover:opacity-100 transition-opacity", isUser ? "pr-1 flex-row-reverse" : "pl-1"), children: [_jsx("button", { type: "button", onClick: handleCopy, className: "p-1 rounded hover:bg-black/10 dark:hover:bg-white/10 transition-colors text-slate-400 hover:text-slate-600 dark:hover:text-slate-200", title: copied ? "已复制" : "复制", "aria-label": "\u590D\u5236\u6D88\u606F", children: copied ? _jsx(Check, { size: 14 }) : _jsx(Copy, { size: 14 }) }), onDelete && (_jsx("button", { type: "button", onClick: handleDelete, className: "p-1 rounded hover:bg-red-100 dark:hover:bg-red-500/20 transition-colors text-slate-400 hover:text-red-500", title: "\u5220\u9664\u6D88\u606F", "aria-label": "\u5220\u9664\u6D88\u606F", children: _jsx(Trash2, { size: 14 }) })), msg.timestamp && (_jsx("span", { className: "text-[11px] text-slate-500 dark:text-slate-500 select-none", children: relativeTime(msg.timestamp) }))] })] }));
});
