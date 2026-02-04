// src/components/ReasoningBlock.tsx
import React, { useState, useMemo } from "react";
import { ChevronDown, ChevronRight, Brain, Clock } from "lucide-react";
import type { ReasoningStep } from "../services/api";

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

export interface ReasoningBlockProps {
  steps: ReasoningStep[];
  isLoading?: boolean;
  className?: string;
}

/**
 * 推理过程折叠块组件
 * 显示 AI 的内部推理步骤，可以折叠/展开
 */
export default function ReasoningBlock({
  steps,
  isLoading = false,
  className,
}: ReasoningBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  // 计算总推理时间
  const duration = useMemo(() => {
    if (steps.length < 2) return null;
    const first = steps[0].timestamp;
    const last = steps[steps.length - 1].timestamp;
    const ms = last - first;
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(1)}s`;
  }, [steps]);

  // 合并所有推理内容用于预览
  const previewText = useMemo(() => {
    const allText = steps.map((s) => s.content).join(" ");
    if (allText.length <= 60) return allText;
    return allText.slice(0, 60) + "...";
  }, [steps]);

  if (steps.length === 0 && !isLoading) {
    return null;
  }

  return (
    <div
      className={cn(
        "mb-2 rounded-lg border overflow-hidden",
        "border-slate-300 bg-slate-100",
        "dark:border-slate-700/50 dark:bg-slate-800/30",
        className
      )}
    >
      {/* 折叠头部 */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2 transition text-left bg-slate-200/50 hover:bg-slate-200 dark:bg-slate-700/30 dark:hover:bg-slate-700/50"
        aria-expanded={isExpanded}
      >
        <div className="flex items-center gap-2 flex-1 min-w-0">
          {isExpanded ? (
            <ChevronDown size={14} className="text-slate-500 dark:text-slate-400 shrink-0" />
          ) : (
            <ChevronRight size={14} className="text-slate-500 dark:text-slate-400 shrink-0" />
          )}
          
          <Brain size={14} className="text-purple-500 dark:text-purple-400 shrink-0" />
          
          <span className="text-sm text-slate-700 dark:text-slate-300">
            {isLoading ? "推理中..." : "推理过程"}
          </span>

          {/* 推理步骤数量 */}
          {steps.length > 0 && (
            <span className="text-xs px-1.5 py-0.5 rounded text-slate-600 bg-slate-200 dark:text-slate-400 dark:bg-slate-800">
              {steps.length} 步
            </span>
          )}

          {/* 耗时 */}
          {duration && (
            <span className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-500">
              <Clock size={10} />
              {duration}
            </span>
          )}
        </div>

        {/* 折叠时显示预览 */}
        {!isExpanded && previewText && (
          <span className="text-xs text-slate-500 truncate max-w-[200px]">
            {previewText}
          </span>
        )}
      </button>

      {/* 展开的内容 */}
      {isExpanded && (
        <div className="px-3 py-2 space-y-2 max-h-64 overflow-y-auto">
          {steps.map((step, index) => (
            <div
              key={index}
              className="text-sm pl-3 border-l-2 text-slate-700 border-purple-400/50 dark:text-slate-300/90 dark:border-purple-500/30"
            >
              <p className="whitespace-pre-wrap break-words">{step.content}</p>
              {step.source && (
                <span className="text-xs text-slate-500 mt-1 block">
                  来源: {step.source}
                </span>
              )}
            </div>
          ))}
          
          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <div className="w-2 h-2 bg-purple-500 dark:bg-purple-400 rounded-full animate-pulse" />
              <span>正在推理...</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
