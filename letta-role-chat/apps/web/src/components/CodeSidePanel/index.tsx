// src/components/CodeSidePanel/index.tsx
import React, { useEffect, useRef, useState, useCallback } from "react";
import type { CodeArtifact } from "../../codepanel/CodePanelProvider";
import CodeArtifactList from "./CodeArtifactList";
import CodeArtifactDetail from "./CodeArtifactDetail";

export type CodeSidePanelProps = {
  open: boolean;
  onClose: () => void;
  // 多代码块支持
  artifacts: CodeArtifact[];
  onRemoveArtifact: (id: string) => void;
  onClearAll: () => void;
  // 受控宽度
  width: number;
  onWidthChange: (w: number) => void;
  minWidth?: number;
  maxWidth?: number;
};

export function CodeSidePanel({
  open,
  onClose,
  artifacts,
  onRemoveArtifact,
  onClearAll,
  width,
  onWidthChange,
  minWidth = 360,
  maxWidth = 980,
}: CodeSidePanelProps) {
  const draggingRef = useRef(false);
  
  // 当前选中查看的代码块 ID（null 表示显示列表）
  const [selectedId, setSelectedId] = useState<string | null>(null);

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
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
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
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) {
        if (selectedId) {
          // 如果在详情页，先返回列表
          setSelectedId(null);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose, selectedId]);

  // 选择代码块查看详情
  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  // 返回列表
  const handleBack = useCallback(() => {
    setSelectedId(null);
  }, []);

  // 删除代码块
  const handleRemove = useCallback((id: string) => {
    onRemoveArtifact(id);
  }, [onRemoveArtifact]);

  return (
    <aside
      className={[
        "fixed top-0 right-0 z-50 h-screen",
        "bg-slate-950 border-l border-white/10",
        "transition-transform duration-200 ease-out",
        "flex flex-col",
        open ? "translate-x-0 pointer-events-auto" : "translate-x-full pointer-events-none",
      ].join(" ")}
      style={{ width }}
      role="dialog"
      aria-modal={open}
      aria-label="代码侧边栏"
      aria-hidden={!open}
    >
      {/* 拖拽条 */}
      <div
        className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500/30 z-10"
        onMouseDown={() => {
          draggingRef.current = true;
          document.body.style.cursor = "col-resize";
          document.body.style.userSelect = "none";
        }}
        title="拖拽调整宽度"
      />

      {/* 顶部标题栏 - 只在列表视图显示 */}
      {!selectedArtifact && (
        <div className="shrink-0 h-12 px-4 flex items-center justify-between bg-slate-950/80 backdrop-blur border-b border-white/10">
          <div className="flex items-center gap-2 text-slate-100">
            <span className="font-semibold">Artifacts</span>
            {artifacts.length > 0 && (
              <span className="text-xs text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded">
                {artifacts.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded-md px-2 py-1 text-sm text-slate-200 hover:bg-slate-800 border border-transparent transition"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>
      )}

      {/* 内容区域 */}
      <div className="flex-1 overflow-hidden">
        {selectedArtifact ? (
          // 详情视图
          <CodeArtifactDetail
            artifact={selectedArtifact}
            onBack={handleBack}
            onClose={onClose}
          />
        ) : (
          // 列表视图
          <CodeArtifactList
            artifacts={artifacts}
            activeId={selectedId}
            onSelect={handleSelect}
            onRemove={handleRemove}
            onClearAll={onClearAll}
          />
        )}
      </div>
    </aside>
  );
}

// 导出默认和命名导出
export default CodeSidePanel;
