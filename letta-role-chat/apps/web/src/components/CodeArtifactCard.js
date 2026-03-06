import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
function cn(...classes) {
    return classes.filter(Boolean).join(" ");
}
export default function CodeArtifactCard({ title, language, lines, chars, onOpen, subtitle = "长代码已移至侧边栏", className, }) {
    const langLabel = (language || "text").toUpperCase();
    return (_jsxs("div", { className: cn("my-2 rounded-xl p-3 ring-1", "flex items-center justify-between gap-3", "bg-slate-100 ring-slate-300", "dark:bg-slate-900/40 dark:ring-white/10", className), children: [_jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "text-xs opacity-70", children: subtitle }), _jsxs("div", { className: "text-sm font-medium truncate", children: [title, " \u00B7 ", langLabel, " \u00B7 ", lines, " \u884C \u00B7 ", chars, " \u5B57\u7B26"] })] }), _jsx("button", { type: "button", onClick: onOpen, className: cn("shrink-0 text-xs px-2 py-1 rounded-md ring-1 transition", "bg-slate-200 hover:bg-slate-300 ring-slate-300", "dark:bg-slate-800/50 dark:hover:bg-slate-800 dark:ring-white/10"), title: "\u5728\u4FA7\u8FB9\u680F\u6253\u5F00", children: "\u5728\u4FA7\u8FB9\u680F\u6253\u5F00" })] }));
}
