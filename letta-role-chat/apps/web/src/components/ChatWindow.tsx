import React, {
  useRef,
  useEffect,
  forwardRef,
  useImperativeHandle,
  useCallback,
} from "react";
import { Role } from "../types";
import { Send, Loader2, Plus } from "lucide-react";
import SelectionTTSButton from "./SelectionTTSButton";
import MessageBubble from "./MessageBubble";
import ComposerPreview from "./ComposerPreview";
import { useChatStream, shouldConvertToAttachment } from "../hooks/useChatStream";

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
      removeTextAttachment,
    } = useChatStream({
      role,
      defaultAutoSpeak,
      onAutoSpeakChange,
    });

    const scrollRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // ✅ 处理粘贴事件：长文本自动转附件
    const handlePaste = useCallback(
      async (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const text = e.clipboardData.getData('text/plain');
        
        // 检查是否应该转换为附件
        if (shouldConvertToAttachment(text)) {
          e.preventDefault(); // 阻止默认粘贴行为
          await handlePastedText(text);
        }
        // 否则使用默认粘贴行为
      },
      [handlePastedText]
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
        {showHeader && (
          <div className={cn("shrink-0 px-4 py-3", headerClassName)}>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="font-semibold truncate">{role.name}</div>
                <div className="text-xs opacity-70">Online</div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => handleAutoSpeakChange(!autoSpeak)}
                  className={cn(
                    "text-xs px-2 py-1 rounded-md ring-1 ring-current/20 transition",
                    autoSpeak ? "bg-primary/10 opacity-100" : "opacity-60 hover:opacity-100"
                  )}
                  title="Auto Speak"
                >
                  {autoSpeak ? "自动朗读:开" : "自动朗读:关"}
                </button>

                <button
                  type="button"
                  onClick={isLoading ? cancelStream : stopSpeak}
                  className="text-xs px-2 py-1 rounded-md ring-1 ring-current/20 opacity-60 hover:opacity-100 transition"
                  title={isLoading ? "Stop Generation" : "Stop Speaking"}
                >
                  {isLoading ? "停止生成" : "停止朗读"}
                </button>

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

              <div className="pb-2">
                <button
                  type="button"
                  onClick={send}
                  disabled={isLoading || (!input.trim() && uploadedImages.length === 0 && textAttachments.length === 0)}
                  className={cn(
                    "p-2.5 rounded-full inline-flex items-center justify-center transition-all",
                    "disabled:opacity-50 disabled:cursor-not-allowed",
                    sendButtonClassName,
                    (!input.trim() && uploadedImages.length === 0 && textAttachments.length === 0) || isLoading
                      ? "opacity-50"
                      : "hover:scale-105"
                  )}
                  title="发送"
                  aria-label="发送消息"
                >
                  {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
);
