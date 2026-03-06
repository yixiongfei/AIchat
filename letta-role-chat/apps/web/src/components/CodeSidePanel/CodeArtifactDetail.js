import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// src/components/CodeSidePanel/CodeArtifactDetail.tsx
import React, { useCallback } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { ArrowLeft, Copy, Check, FileCode, FileText, File } from "lucide-react";
// 根据语言获取图标
function getFileIcon(language) {
    const lang = language.toLowerCase();
    const codeTypes = [
        "javascript", "typescript", "tsx", "jsx", "js", "ts",
        "python", "py", "java", "c", "cpp", "csharp", "cs",
        "go", "rust", "ruby", "php", "swift", "kotlin",
        "html", "css", "scss", "less", "sql", "shell", "bash",
        "json", "yaml", "yml", "xml", "graphql"
    ];
    const docTypes = ["markdown", "md", "txt", "text"];
    if (codeTypes.includes(lang)) {
        return _jsx(FileCode, { size: 16, className: "text-blue-400" });
    }
    if (docTypes.includes(lang)) {
        return _jsx(FileText, { size: 16, className: "text-emerald-400" });
    }
    return _jsx(File, { size: 16, className: "text-slate-400" });
}
export default function CodeArtifactDetail({ artifact, onBack, onClose, }) {
    const [copied, setCopied] = React.useState(false);
    const isDark = typeof document !== "undefined" && document.documentElement.classList.contains("dark");
    const lines = artifact.code ? artifact.code.split("\n").length : 0;
    const chars = artifact.code?.length || 0;
    const langLabel = (artifact.language || "text").toUpperCase();
    const handleCopy = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(artifact.code || "");
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
        catch {
            // fallback
            const ta = document.createElement("textarea");
            ta.value = artifact.code || "";
            document.body.appendChild(ta);
            ta.select();
            document.execCommand("copy");
            document.body.removeChild(ta);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    }, [artifact.code]);
    return (_jsxs("div", { className: "flex flex-col h-full", children: [_jsxs("div", { className: "shrink-0 px-3 py-2.5 flex items-center gap-3 border-b border-slate-200/70 dark:border-slate-800/50 bg-white/70 dark:bg-slate-900/50", children: [_jsx("button", { type: "button", onClick: onBack, className: "p-1.5 rounded-md text-slate-500 hover:bg-slate-200 transition dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200", title: "\u8FD4\u56DE\u5217\u8868", "aria-label": "\u8FD4\u56DE\u5217\u8868", children: _jsx(ArrowLeft, { size: 18 }) }), _jsxs("div", { className: "flex items-center gap-2 min-w-0 flex-1", children: [getFileIcon(artifact.language), _jsx("span", { className: "text-sm font-medium text-slate-700 dark:text-slate-100 truncate", children: artifact.title })] }), _jsxs("div", { className: "flex items-center gap-2 shrink-0 text-xs text-slate-500 dark:text-slate-400", children: [_jsx("span", { children: langLabel }), _jsx("span", { children: "\u00B7" }), _jsxs("span", { children: [lines, " \u884C"] }), _jsx("span", { children: "\u00B7" }), _jsxs("span", { children: [chars, " \u5B57\u7B26"] })] }), _jsx("button", { type: "button", onClick: handleCopy, className: [
                            "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs transition",
                            copied
                                ? "bg-green-100 text-green-600 dark:bg-green-500/20 dark:text-green-400"
                                : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                        ].join(" "), title: "\u590D\u5236\u4EE3\u7801", children: copied ? (_jsxs(_Fragment, { children: [_jsx(Check, { size: 14 }), _jsx("span", { children: "\u5DF2\u590D\u5236" })] })) : (_jsxs(_Fragment, { children: [_jsx(Copy, { size: 14 }), _jsx("span", { children: "\u590D\u5236" })] })) }), onClose && (_jsx("button", { type: "button", onClick: onClose, className: "p-1.5 rounded-md text-slate-500 hover:bg-slate-200 transition dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200", title: "\u5173\u95ED", "aria-label": "\u5173\u95ED", children: "\u2715" }))] }), _jsx("div", { className: "flex-1 overflow-auto bg-slate-50 dark:bg-slate-950/10", children: artifact.code ? (_jsx(SyntaxHighlighter, { language: artifact.language, style: isDark ? vscDarkPlus : oneLight, showLineNumbers: true, customStyle: {
                        margin: 0,
                        background: "transparent",
                        padding: "12px",
                        fontSize: "13px",
                        lineHeight: "1.6",
                    }, lineNumberStyle: {
                        color: isDark ? "rgba(255,255,255,0.35)" : "rgba(15,23,42,0.45)",
                        minWidth: "2.5em",
                        paddingRight: "1em",
                    }, children: artifact.code })) : (_jsx("div", { className: "p-4 text-slate-500 dark:text-slate-400 text-center", children: "\u65E0\u5185\u5BB9" })) })] }));
}
