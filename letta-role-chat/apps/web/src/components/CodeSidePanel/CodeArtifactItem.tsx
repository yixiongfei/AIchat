// src/components/CodeSidePanel/CodeArtifactItem.tsx
import React from "react";
import { FileCode, FileText, File, X } from "lucide-react";
import type { CodeArtifact } from "../../codepanel/CodePanelProvider";

// 根据语言获取图标和类型标签
function getFileInfo(language: string): { icon: React.ReactNode; typeLabel: string } {
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
      icon: <FileCode size={18} className="text-blue-400" />,
      typeLabel: `Code · ${lang.toUpperCase()}`
    };
  }
  
  if (docTypes.includes(lang)) {
    return {
      icon: <FileText size={18} className="text-emerald-400" />,
      typeLabel: `Document · ${lang.toUpperCase()}`
    };
  }
  
  return {
    icon: <File size={18} className="text-slate-400" />,
    typeLabel: lang.toUpperCase() || "TEXT"
  };
}

export type CodeArtifactItemProps = {
  artifact: CodeArtifact;
  isActive?: boolean;
  onClick: () => void;
  onRemove: () => void;
};

export default function CodeArtifactItem({
  artifact,
  isActive,
  onClick,
  onRemove,
}: CodeArtifactItemProps) {
  const { icon, typeLabel } = getFileInfo(artifact.language);
  const lines = artifact.code ? artifact.code.split("\n").length : 0;

  return (
    <div
      className={[
        "group flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer transition-all",
        "hover:bg-slate-800/60",
        isActive
          ? "bg-slate-800/80 ring-1 ring-blue-500/50"
          : "bg-slate-800/30",
      ].join(" ")}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onClick();
      }}
    >
      {/* 图标区域 */}
      <div className="shrink-0 w-10 h-10 rounded-lg bg-slate-700/50 flex items-center justify-center">
        {icon}
      </div>

      {/* 内容区域 */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-slate-200 truncate">
          {artifact.title}
        </div>
        <div className="text-xs text-slate-500 truncate">
          {typeLabel} · {lines} 行
        </div>
      </div>

      {/* 删除按钮 */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
        className="shrink-0 p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-slate-400 hover:text-red-400 transition-all"
        title="删除"
        aria-label="删除代码块"
      >
        <X size={14} />
      </button>
    </div>
  );
}
