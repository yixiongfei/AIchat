import React, {
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import { Role } from "../types";
import { Send, Loader2, Plus, Volume2, VolumeX, Square, ArrowUp, Info } from "lucide-react";
import SelectionTTSButton from "./SelectionTTSButton";
import MessageBubble from "./MessageBubble";
import ComposerPreview from "./ComposerPreview";
import { useChatStream, shouldConvertToAttachment } from "../hooks/useChatStream";
import { useBackgroundLoading } from "../hooks/useBackgroundLoading";

const cn = (...classes: Array<string | false | null | undefined>) =>
  classes.filter(Boolean).join(" ");

interface ChatWindowProps {
  role: Role;
  className?: string;
  headerClassName?: string;
  bodyClassName?: string;
  bodyInnerClassName?: string;
  inputBarClassName?: string;
  inputClassName?: string;
  sendButtonClassName?: string;
  userBubbleClassName?: string;
  assistantBubbleClassName?: string;
  showHeader?: boolean;
  defaultAutoSpeak?: boolean;
  onAutoSpeakChange?: (value: boolean) => void;
  autoOpenLongCode?: boolean;
}

export interface ChatWindowHandle {
  toggleAutoSpeak: () => void;
  stopSpeak: () => void;
  clearHistory: () => Promise<void>;
}

export const ChatWindow = forwardRef<ChatWindowHandle, ChatWindowProps>(
  (
    {
      role,
      className,
      headerClassName,
      bodyClassName,
      bodyInnerClassName,
      inputBarClassName,
      inputClassName,
      sendButtonClassName,
      userBubbleClassName,
      assistantBubbleClassName,
      showHeader = true,
      defaultAutoSpeak = false,
      onAutoSpeakChange,
      autoOpenLongCode = true,
    },
    ref
  ) => {
    // ✅ 使用统一的 hook，消除重复逻辑
    const {
      messages,
      input,
      setInput,
      isLoading,
      autoSpeak,
      uploadedImages,
      textAttachments,
      inputCodeCards,
      collapsedMap,
      toggleCodeCard,
      expandedMap,
      toggleExpanded,
      send,
      cancelStream,
      stopSpeak,
      clearHistory,
      handleAutoSpeakChange,
      fileInputRef,
      openFileDialog,
      handleImageUpload,
      removeImage,
      handlePastedText,
      handlePastedImages,
      removeTextAttachment,
    } = useChatStream({
      role,
      defaultAutoSpeak,
      onAutoSpeakChange,
    });

    // ✅ 获取后台 loading 状态
    const { backgroundCount, hasBackgroundLoading } = useBackgroundLoading(role.id);

    const scrollRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // ✅ 处理粘贴事件：支持文本附件和图片粘贴
    const handlePaste = useCallback(
      async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const clipboardData = e.clipboardData;
        
        // 1. 优先检查是否有图片
        const items = clipboardData.items;
        const imageItems = Array.from(items).filter(item => item.type.startsWith('image/'));
        
        if (imageItems.length > 0) {
          e.preventDefault(); // 阻止默认粘贴
          
          // 处理所有粘贴的图片
          const files = imageItems
            .map(item => item.getAsFile())
            .filter((file): file is File => file !== null);
          
          if (files.length > 0) {
            await handlePastedImages(files);
          }
          return;
        }
        
        // 2. 检查是否是长文本需要转附件
        const text = clipboardData.getData('text/plain');
        if (shouldConvertToAttachment(text)) {
          e.preventDefault(); // 阻止默认粘贴行为
          await handlePastedText(text);
        }
        // 否则使用默认粘贴行为
      },
      [handlePastedText, handlePastedImages]
    );

    // 暴露给父组件的方法
    useImperativeHandle(
      ref,
      () => ({
        toggleAutoSpeak: () => handleAutoSpeakChange(!autoSpeak),
        stopSpeak,
        clearHistory,
      }),
      [stopSpeak, autoSpeak, handleAutoSpeakChange, clearHistory]
    );

    // 自动滚动到底部
    useEffect(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    }, [messages]);

    // 自动调整 textarea 高度
    useEffect(() => {
      const textarea = textareaRef.current;
      if (!textarea) return;
      textarea.style.height = "auto";
      const newHeight = Math.min(Math.max(textarea.scrollHeight, 40), 120);
      textarea.style.height = `${newHeight}px`;
    }, [input]);

    return (
      <div className={cn("flex h-full min-w-0 flex-col", className)}>
        {/* ✅ 后台 loading 提示条：当其他 agent 正在思考时显示 */}
        {hasBackgroundLoading && (
          <div className="shrink-0 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-100 dark:border-blue-800/50 flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300">
            <Loader2 size={14} className="animate-spin" />
            <span>
              {backgroundCount} 个其他 Agent 正在后台思考中，切换回去可查看响应
            </span>
          </div>
        )}

        {showHeader && (
          <div className={cn("shrink-0 px-4 py-3", headerClassName)}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold truncate">{role.name}</div>
                <div className="text-xs opacity-70">Online</div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {/* 自动朗读按钮 */}
                <button
                  type="button"
                  onClick={() => handleAutoSpeakChange(!autoSpeak)}
                  className={cn(
                    "p-2 rounded-full transition-colors",
                    autoSpeak
                      ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"
                  )}
                  title={autoSpeak ? "关闭自动朗读" : "开启自动朗读"}
                  aria-label={autoSpeak ? "关闭自动朗读" : "开启自动朗读"}
                >
                  {autoSpeak ? <Volume2 size={20} /> : <VolumeX size={20} />}
                </button>

                {/* 停止朗读按钮 - 仅在自动朗读开启时显示 */}
                {autoSpeak && (
                  <button
                    type="button"
                    onClick={stopSpeak}
                    className="p-2 rounded-full text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors"
                    title="停止朗读"
                    aria-label="停止朗读"
                  >
                    <Square size={18} fill="currentColor" />
                  </button>
                )}

                <button
                  type="button"
                  onClick={clearHistory}
                  className="text-xs px-2 py-1 rounded-md ring-1 ring-current/20 opacity-60 hover:opacity-100 transition"
                  title="Clear History"
                >
                  清空历史
                </button>

                <div className="text-xs opacity-60">{messages.length} msgs</div>
              </div>
            </div>
          </div>
        )}

        <div ref={scrollRef} className={cn("flex-1 overflow-y-auto px-4 py-4", bodyClassName)}>
          <div ref={containerRef} className="w-full">
            <div className={cn("mx-auto w-full max-w-3xl space-y-2", bodyInnerClassName)}>
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  msg={msg}
                  role={role}
                  userBubbleClassName={userBubbleClassName}
                  assistantBubbleClassName={assistantBubbleClassName}
                  expanded={!!expandedMap[msg.id]}
                  onToggleExpandedById={toggleExpanded}
                  autoOpenLongCode={autoOpenLongCode}
                />
              ))}

              {isLoading &&
                !messages.some((m) => m.role === "assistant" && m.id.startsWith("assistant-")) && (
                  <div className="flex justify-start">
                    <div className={cn("rounded-2xl rounded-tl-md px-4 py-3", assistantBubbleClassName)}>
                      <Loader2 className="animate-spin opacity-70" size={18} />
                    </div>
                  </div>
                )}
            </div>
          </div>

          <SelectionTTSButton
            containerRef={containerRef}
            roleConfig={{
              voice: role?.voice,
              speed: role?.speed,
              pitch: role?.pitch,
              style: role?.style,
            }}
          />
        </div>

        <div className={cn("shrink-0 px-4 py-4", inputBarClassName)}>
          <div className="mx-auto w-full max-w-[1100px]">
            {/* ✅ 使用 ComposerPreview 组件，复用代码卡片、图片和文本附件预览逻辑 */}
            <ComposerPreview
              uploadedImages={uploadedImages}
              onRemoveImage={removeImage}
              codeCards={inputCodeCards}
              collapsedMap={collapsedMap}
              onToggleCodeCard={toggleCodeCard}
              textAttachments={textAttachments}
              onRemoveTextAttachment={removeTextAttachment}
            />

            <div className={cn("relative flex items-end gap-2 rounded-2xl px-3 py-2", inputClassName)}>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                onChange={handleImageUpload}
                className="hidden"
                aria-label="上传图片"
              />

              <div className="flex items-center pb-2">
                <button
                  type="button"
                  onClick={openFileDialog}
                  disabled={isLoading}
                  className="p-2 rounded-full hover:bg-slate-800/50 transition-colors text-slate-400 hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  title="上传图片"
                  aria-label="选择要上传的图片"
                >
                  <Plus size={20} />
                </button>
              </div>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onPaste={handlePaste}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    send();
                  }
                }}
                placeholder={`Message ${role.name}...`}
                className="flex-1 resize-none bg-transparent text-sm outline-none min-h-[40px] max-h-[120px] py-2 text-slate-100 placeholder:text-slate-400"
                style={{ height: "40px" }}
              />

              {/* 发送按钮 */}
              <div className="pb-2">
                <button
                  type="button"
                  onClick={send}
                  disabled={isLoading || (!input.trim() && uploadedImages.length === 0 && textAttachments.length === 0)}
                  className={cn(
                    "w-9 h-9 rounded-full inline-flex items-center justify-center transition-all",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    (!input.trim() && uploadedImages.length === 0 && textAttachments.length === 0) || isLoading
                      ? "bg-slate-700 text-slate-400"
                      : "bg-blue-600 hover:bg-blue-500 text-white hover:scale-105",
                    sendButtonClassName
                  )}
                  title="发送"
                  aria-label="发送消息"
                >
                  {isLoading ? <Loader2 size={18} className="animate-spin" /> : <ArrowUp size={20} strokeWidth={2.5} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
