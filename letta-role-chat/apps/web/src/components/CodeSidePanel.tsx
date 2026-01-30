
// CodeSidePanel.tsx
import React, { useEffect, useMemo, useRef } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

type CodeSidePanelProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  language?: string;
  code?: string;

  // ✅ 新增：受控宽度
  width: number;
  onWidthChange: (w: number) => void;

  minWidth?: number;
  maxWidth?: number;
};

export function CodeSidePanel({
  open,
  onClose,
  title = "Code",
  language = "text",
  code = "",
  width,
  onWidthChange,
  minWidth = 360,
  maxWidth = 980,
}: CodeSidePanelProps) {
  const draggingRef = useRef(false);

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!draggingRef.current) return;
      const next = window.innerWidth - e.clientX; // 右侧面板宽度
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

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const langLabel = useMemo(() => (language || "text").toUpperCase(), [language]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code || "");
    } catch {
      const ta = document.createElement("textarea");
      ta.value = code || "";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
  };

  return (
    <>
      <aside
        className={[
          "fixed top-0 right-0 z-50 h-screen",
          "bg-slate-950 border-l border-white/10",
          "transition-transform duration-200 ease-out",
          open ? "translate-x-0 pointer-events-auto" : "translate-x-full pointer-events-none",
        ].join(" ")}
        style={{ width }}
        aria-hidden={!open}
      >
        {/* 拖拽条 */}
        <div
          className="absolute left-0 top-0 h-full w-1 cursor-col-resize hover:bg-blue-500/30"
          onMouseDown={() => {
            draggingRef.current = true;
            document.body.style.cursor = "col-resize";
            document.body.style.userSelect = "none";
          }}
          title="Drag to resize"
        />

        {/* Header */}
        <div className="h-12 px-3 flex items-center justify-between bg-slate-950/80 backdrop-blur border-b border-white/10">
          <div className="min-w-0 flex items-baseline gap-2 text-slate-100">
            <span className="font-semibold truncate">{title}</span>
            <span className="text-xs text-slate-400 shrink-0">{langLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copy}
              className="rounded-md px-2 py-1 text-sm text-slate-100 bg-slate-800 hover:bg-slate-700 border border-white/10"
            >
              Copy
            </button>
            <button
              onClick={onClose}
              className="rounded-md px-2 py-1 text-sm text-slate-200 hover:bg-slate-800 border border-transparent"
              aria-label="Close"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="h-[calc(100vh-3rem)] overflow-auto">
          {code ? (
            <SyntaxHighlighter
              language={language}
              style={vscDarkPlus}
              showLineNumbers
              customStyle={{
                margin: 0,
                background: "transparent",
                padding: "12px",
                fontSize: "13px",
                lineHeight: "1.6",
              }}
              lineNumberStyle={{
                color: "rgba(255,255,255,0.35)",
                minWidth: "2.5em",
                paddingRight: "1em",
              }}
            >
              {code}
            </SyntaxHighlighter>
          ) : (
            <div className="p-4 text-slate-400">まだコードがありません。</div>
          )}
        </div>
      </aside>
    </>
  );
}
