import React from "react";
import { X, Code, ChevronDown, ChevronUp, FileText } from "lucide-react";
import type { UploadedImage, CodeCard, TextAttachment } from "../hooks/useChatStream";

interface ComposerPreviewProps {
  uploadedImages: UploadedImage[];
  onRemoveImage: (id: string) => void;

  codeCards: CodeCard[];
  collapsedMap: Record<string, boolean>;
  onToggleCodeCard: (id: string) => void;

  textAttachments?: TextAttachment[];
  onRemoveTextAttachment?: (id: string) => void;
}

export default function ComposerPreview({
  uploadedImages,
  onRemoveImage,
  codeCards,
  collapsedMap,
  onToggleCodeCard,
  textAttachments = [],
  onRemoveTextAttachment,
}: ComposerPreviewProps) {
  return (
    <>
      {/* ✅ 文本附件预览区 - 卡片带内容预览 */}
      {textAttachments.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {textAttachments.map((attachment) => {
            // 截取前几行预览
            const previewLines = attachment.content.split(/\r?\n/).slice(0, 4);
            const preview = previewLines.join('\n');
            const hasMore = attachment.lineCount > 4;

            return (
              <div
                key={attachment.id}
                className="group relative w-[125px] rounded-lg border border-slate-600/60 bg-slate-800/60 hover:bg-slate-700/60 transition-colors overflow-hidden"
              >
                {/* 头部：文件名 + 删除 */}
                <div className="flex items-center justify-between px-2 py-1.5 bg-slate-700/30">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <FileText size={12} className="text-blue-400 shrink-0" />
                    <span className="text-slate-200 text-xs font-medium truncate">
                      {attachment.fileName}
                    </span>
                    <span className="text-slate-500 text-[10px] shrink-0">
                      {attachment.lineCount}行
                    </span>
                  </div>
                  {onRemoveTextAttachment && (
                    <button
                      type="button"
                      onClick={() => onRemoveTextAttachment(attachment.id)}
                      className="p-0.5 rounded hover:bg-slate-500/50 text-slate-400 hover:text-red-400 transition shrink-0"
                      title="删除附件"
                      aria-label="删除附件"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>
                {/* 内容预览 */}
                <div className="px-2 py-1.5 text-[10px] text-slate-400 font-mono whitespace-pre-wrap break-all max-h-20 overflow-hidden leading-tight">
                  {preview}
                  {hasMore && (
                    <span className="text-slate-500 italic">...</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ✅ 代码卡片预览区 */}
      {codeCards.length > 0 && (
        <div className="mb-3 space-y-2">
          {codeCards.map((card) => {
            const collapsed = collapsedMap[card.id] ?? true;
            const lines = card.code ? card.code.split("\n").length : 0;

            return (
              <div
                key={card.id}
                className="rounded-lg border border-slate-700/50 bg-slate-800/50 overflow-hidden"
              >
                <div
                  className="flex items-center justify-between px-3 py-2 bg-slate-700/30 cursor-pointer hover:bg-slate-700/50 transition"
                  onClick={() => onToggleCodeCard(card.id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") onToggleCodeCard(card.id);
                  }}
                  aria-label={`切换代码块 ${card.language || "code"} 展开/折叠`}
                >
                  <div className="flex items-center gap-2 text-sm text-slate-300">
                    <Code size={14} />
                    <span>{card.language || "code"}</span>
                    <span className="text-xs text-slate-500">({lines} 行)</span>
                  </div>

                  {collapsed ? (
                    <ChevronDown size={16} className="text-slate-400" />
                  ) : (
                    <ChevronUp size={16} className="text-slate-400" />
                  )}
                </div>

                {!collapsed && (
                  <pre className="p-3 text-xs text-slate-200 overflow-x-auto max-h-48 overflow-y-auto">
                    <code>{card.code}</code>
                  </pre>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ✅ 图片预览区 */}
      {uploadedImages.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {uploadedImages.map((img) => (
            <div
              key={img.id}
              className="relative group rounded-lg overflow-hidden border border-slate-700/50"
            >
              <img
                src={img.preview}
                alt="Upload preview"
                className="h-20 w-20 object-cover"
              />
              <button
                type="button"
                onClick={() => onRemoveImage(img.id)}
                className="absolute top-1 right-1 p-1 rounded-full bg-slate-900/80 text-slate-100 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                title="删除图片"
                aria-label="删除图片"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  );
}