
// src/components/CodeArtifactCard.tsx
import React from "react";

export type CodeArtifactCardProps = {
  /** 展示标题（如：role-name-snippet-1） */
  title: string;
  /** 语言（如：ts、python），用于展示标签 */
  language: string;
  /** 行数 */
  lines: number;
  /** 字符数 */
  chars: number;
  /** 点击“在侧边栏打开” */
  onOpen: () => void;

  /** 可选：自定义文案 */
  subtitle?: string;
  /** 可选：额外 className */
  className?: string;
};

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function CodeArtifactCard({
  title,
  language,
  lines,
  chars,
  onOpen,
  subtitle = "长代码已移至侧边栏",
  className,
}: CodeArtifactCardProps) {
  const langLabel = (language || "text").toUpperCase();

  return (
    <div
      className={cn(
        "my-2 rounded-xl bg-slate-900/40 ring-1 ring-white/10 p-3",
        "flex items-center justify-between gap-3",
        className
      )}
    >
      <div className="min-w-0">
        <div className="text-xs opacity-70">{subtitle}</div>
        <div className="text-sm font-medium truncate">
          {title} · {langLabel} · {lines} 行 · {chars} 字符
        </div>
      </div>

      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "shrink-0 text-xs px-2 py-1 rounded-md",
          "bg-slate-800/50 hover:bg-slate-800",
          "ring-1 ring-white/10 transition"
        )}
        title="在侧边栏打开"
      >
        在侧边栏打开
      </button>
    </div>
  );
}
