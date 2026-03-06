import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// src/components/ReasoningBlock.tsx
import { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Brain, Clock } from "lucide-react";
import Markdown from "./Markdown";
const cn = (...classes) => classes.filter(Boolean).join(" ");
/**
 * 推理过程折叠块组件
 * 显示 AI 的完整推理内容，默认折叠，用户可手动展开
 */
export default function ReasoningBlock({ steps, isLoading = false, className, }) {
    const [isExpanded, setIsExpanded] = useState(false); // 默认折叠
    // 计算总推理时间
    const duration = useMemo(() => {
        if (steps.length < 2)
            return null;
        const first = steps[0].timestamp;
        const last = steps[steps.length - 1].timestamp;
        const ms = last - first;
        if (ms < 1000)
            return `${ms}ms`;
        return `${(ms / 1000).toFixed(1)}s`;
    }, [steps]);
    // 合并所有推理内容为完整文本
    const fullContent = useMemo(() => {
        return steps.map((s) => s.content).join("");
    }, [steps]);
    // 折叠时的预览文本
    const previewText = useMemo(() => {
        if (fullContent.length <= 80)
            return fullContent;
        return fullContent.slice(0, 80) + "...";
    }, [fullContent]);
    if (steps.length === 0 && !isLoading) {
        return null;
    }
    return (_jsxs("div", { className: cn("mb-3 rounded-lg border overflow-hidden", "border-slate-300/50 bg-slate-100/50", "dark:border-slate-700/30 dark:bg-slate-800/20", className), children: [_jsxs("button", { type: "button", onClick: () => setIsExpanded(!isExpanded), className: "w-full flex items-center gap-2 px-3 py-1.5 transition text-left hover:bg-slate-200/50 dark:hover:bg-slate-700/30", "aria-expanded": isExpanded, children: [_jsxs("div", { className: "flex items-center gap-2 flex-1 min-w-0", children: [isExpanded ? (_jsx(ChevronDown, { size: 14, className: "text-slate-400 dark:text-slate-500 shrink-0" })) : (_jsx(ChevronRight, { size: 14, className: "text-slate-400 dark:text-slate-500 shrink-0" })), _jsx(Brain, { size: 14, className: "text-purple-400 dark:text-purple-500 shrink-0" }), _jsx("span", { className: "text-xs text-slate-500 dark:text-slate-400", children: isLoading ? "推理中..." : "推理过程" }), duration && (_jsxs("span", { className: "flex items-center gap-1 text-xs text-slate-400 dark:text-slate-500", children: [_jsx(Clock, { size: 10 }), duration] }))] }), !isExpanded && previewText && (_jsx("span", { className: "text-xs text-slate-400 dark:text-slate-500 truncate max-w-[300px]", children: previewText }))] }), isExpanded && (_jsxs("div", { className: "px-3 pb-3 pt-1", children: [_jsx(Markdown, { text: fullContent, className: "text-sm text-slate-600 dark:text-slate-300/80 leading-relaxed prose prose-sm prose-slate dark:prose-invert max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5" }), isLoading && (_jsx("span", { className: "inline-block w-1.5 h-4 ml-0.5 bg-purple-400 dark:bg-purple-500 animate-pulse align-middle" }))] }))] }));
}
