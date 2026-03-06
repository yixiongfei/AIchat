import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
// src/components/CodeSidePanel/index.tsx
import { useEffect, useRef, useState, useCallback } from "react";
import CodeArtifactList from "./CodeArtifactList";
import CodeArtifactDetail from "./CodeArtifactDetail";
export function CodeSidePanel({ open, onClose, artifacts, onRemoveArtifact, onClearAll, width, onWidthChange, minWidth = 360, maxWidth = 980, }) {
    const draggingRef = useRef(false);
    // 当前选中查看的代码块 ID（null 表示显示列表）
    const [selectedId, setSelectedId] = useState(null);
    // 获取当前选中的代码块
    const selectedArtifact = selectedId
        ? artifacts.find((a) => a.id === selectedId)
        : null;
    // 如果选中的代码块被删除，返回列表
    useEffect(() => {
        if (selectedId && !artifacts.find((a) => a.id === selectedId)) {
            setSelectedId(null);
        }
    }, [artifacts, selectedId]);
    // 关闭面板时重置选中状态
    useEffect(() => {
        if (!open) {
            setSelectedId(null);
        }
    }, [open]);
    // 拖拽调整宽度
    useEffect(() => {
        const onMove = (e) => {
            if (!draggingRef.current)
                return;
            const next = window.innerWidth - e.clientX;
            const clamped = Math.min(maxWidth, Math.max(minWidth, next));
            onWidthChange(clamped);
        };
        const onUp = () => {
            draggingRef.current = false;
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
        };
        window.addEventListener("mousemove", onMove);
        window.addEventListener("mouseup", onUp);
        return () => {
            window.removeEventListener("mousemove", onMove);
            window.removeEventListener("mouseup", onUp);
        };
    }, [minWidth, maxWidth, onWidthChange]);
    // ESC 关闭
    useEffect(() => {
        const onKeyDown = (e) => {
            if (e.key === "Escape" && open) {
                if (selectedId) {
                    // 如果在详情页，先返回列表
                    setSelectedId(null);
                }
                else {
                    onClose();
                }
            }
        };
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [open, onClose, selectedId]);
    // 选择代码块查看详情
    const handleSelect = useCallback((id) => {
        setSelectedId(id);
    }, []);
    // 返回列表
    const handleBack = useCallback(() => {
        setSelectedId(null);
    }, []);
    // 删除代码块
    const handleRemove = useCallback((id) => {
        onRemoveArtifact(id);
    }, [onRemoveArtifact]);
    return (_jsxs("aside", { className: [
            "fixed top-0 right-0 z-50 h-full min-h-0",
            "transition-transform duration-200 ease-out",
            "flex flex-col backdrop-blur",
            "bg-white/95 border-l border-slate-200/70 text-slate-900",
            "dark:bg-slate-950/95 dark:border-white/10 dark:text-slate-50",
            open ? "translate-x-0 pointer-events-auto" : "translate-x-full pointer-events-none",
        ].join(" "), style: { width }, role: "dialog", "aria-modal": open, "aria-label": "\u4EE3\u7801\u4FA7\u8FB9\u680F", "aria-hidden": !open, children: [_jsx("div", { className: "absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500/30 dark:hover:bg-blue-400/30 z-10", onMouseDown: () => {
                    draggingRef.current = true;
                    document.body.style.cursor = "col-resize";
                    document.body.style.userSelect = "none";
                }, title: "\u62D6\u62FD\u8C03\u6574\u5BBD\u5EA6" }), !selectedArtifact && (_jsxs("div", { className: "shrink-0 h-12 px-4 flex items-center justify-between bg-white/80 dark:bg-slate-950/80 border-b border-slate-200/70 dark:border-white/10", children: [_jsxs("div", { className: "flex items-center gap-2 text-slate-700 dark:text-slate-100", children: [_jsx("span", { className: "font-semibold", children: "\u4EE3\u7801\u5757" }), artifacts.length > 0 && (_jsx("span", { className: "text-xs text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded", children: artifacts.length }))] }), _jsx("button", { onClick: onClose, className: "rounded-md px-2 py-1 text-sm text-slate-500 hover:bg-slate-200/80 border border-transparent transition dark:text-slate-200 dark:hover:bg-slate-800", "aria-label": "\u5173\u95ED", children: "\u2715" })] })), _jsx("div", { className: "flex-1 overflow-hidden", children: selectedArtifact ? (
                // 详情视图
                _jsx(CodeArtifactDetail, { artifact: selectedArtifact, onBack: handleBack, onClose: onClose })) : (
                // 列表视图
                _jsx(CodeArtifactList, { artifacts: artifacts, activeId: selectedId, onSelect: handleSelect, onRemove: handleRemove, onClearAll: onClearAll })) })] }));
}
// 导出默认和命名导出
export default CodeSidePanel;
