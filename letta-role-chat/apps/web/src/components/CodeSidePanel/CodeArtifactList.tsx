// src/components/CodeSidePanel/CodeArtifactList.tsx
import React from "react";
import { Trash2, FolderOpen } from "lucide-react";
import type { CodeArtifact } from "../../codepanel/CodePanelProvider";
import CodeArtifactItem from "./CodeArtifactItem";

export type CodeArtifactListProps = {
  artifacts: CodeArtifact[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onRemove: (id: string) => void;
  onClearAll: () => void;
};

export default function CodeArtifactList({
  artifacts,
  activeId,
  onSelect,
  onRemove,
  onClearAll,
}: CodeArtifactListProps) {
  if (artifacts.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 p-8">
        <FolderOpen size={48} className="mb-4 opacity-50" />
        <p className="text-sm">暂无代码块</p>
        <p className="text-xs mt-1 opacity-70">打开长代码时会自动添加到这里</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* 列表头部 */}
      <div className="shrink-0 px-4 py-3 flex items-center justify-between border-b border-slate-800/50">
        <span className="text-sm text-slate-400">
          {artifacts.length} 个代码块
        </span>
        <button
          type="button"
          onClick={onClearAll}
          className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs text-slate-400 hover:text-red-400 hover:bg-red-500/10 transition"
          title="清空所有"
        >
          <Trash2 size={14} />
          <span>清空</span>
        </button>
      </div>

      {/* 列表内容 */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {artifacts.map((artifact) => (
          <CodeArtifactItem
            key={artifact.id}
            artifact={artifact}
            isActive={artifact.id === activeId}
            onClick={() => onSelect(artifact.id)}
            onRemove={() => onRemove(artifact.id)}
          />
        ))}
      </div>
    </div>
  );
}
