import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { FileCode, FileText, File, X } from "lucide-react";
// 根据语言获取图标和类型标签
function getFileInfo(language) {
    const lang = language.toLowerCase();
    // 代码类型
    const codeTypes = [
        "javascript", "typescript", "tsx", "jsx", "js", "ts",
        "python", "py", "java", "c", "cpp", "csharp", "cs",
        "go", "rust", "ruby", "php", "swift", "kotlin",
        "html", "css", "scss", "less", "sql", "shell", "bash",
        "json", "yaml", "yml", "xml", "graphql"
    ];
    // 文档类型
    const docTypes = ["markdown", "md", "txt", "text"];
    if (codeTypes.includes(lang)) {
        return {
            icon: _jsx(FileCode, { size: 18, className: "text-blue-400" }),
            typeLabel: `Code · ${lang.toUpperCase()}`
        };
    }
    if (docTypes.includes(lang)) {
        return {
            icon: _jsx(FileText, { size: 18, className: "text-emerald-400" }),
            typeLabel: `Document · ${lang.toUpperCase()}`
        };
    }
    return {
        icon: _jsx(File, { size: 18, className: "text-slate-400" }),
        typeLabel: lang.toUpperCase() || "TEXT"
    };
}
export default function CodeArtifactItem({ artifact, isActive, onClick, onRemove, }) {
    const { icon, typeLabel } = getFileInfo(artifact.language);
    const lines = artifact.code ? artifact.code.split("\n").length : 0;
    const preview = artifact.code
        ? artifact.code.split("\n").find((line) => line.trim().length > 0) || "(空内容)"
        : "(空内容)";
    return (_jsxs("div", { className: [
            "group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all",
            isActive
                ? "bg-blue-50/70 text-blue-700 ring-1 ring-blue-400/40 dark:bg-slate-800/80 dark:text-slate-100 dark:ring-blue-500/50"
                : "bg-slate-100/70 text-slate-700 hover:bg-slate-200/70 dark:bg-slate-800/40 dark:text-slate-200 dark:hover:bg-slate-800/70",
        ].join(" "), onClick: onClick, role: "button", tabIndex: 0, onKeyDown: (e) => {
            if (e.key === "Enter" || e.key === " ")
                onClick();
        }, children: [_jsx("div", { className: "shrink-0 w-10 h-10 rounded-lg bg-slate-200 dark:bg-slate-700/50 flex items-center justify-center", children: icon }), _jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("div", { className: "text-sm font-medium truncate", children: artifact.title }), _jsxs("div", { className: "text-xs text-slate-500 dark:text-slate-400 truncate", children: [typeLabel, " \u00B7 ", lines, " \u884C"] }), _jsx("div", { className: "text-xs text-slate-400 dark:text-slate-500 truncate", title: preview, children: preview })] }), _jsx("button", { type: "button", onClick: (e) => {
                    e.stopPropagation();
                    onRemove();
                }, className: "shrink-0 p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-100 text-slate-400 hover:text-red-500 transition-all dark:hover:bg-red-500/20", title: "\u5220\u9664", "aria-label": "\u5220\u9664\u4EE3\u7801\u5757", children: _jsx(X, { size: 14 }) })] }));
}
