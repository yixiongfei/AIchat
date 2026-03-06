import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle, useCallback, } from "react";
import { Loader2, Plus, Volume2, VolumeX, Square, ArrowUp } from "lucide-react";
import SelectionTTSButton from "./SelectionTTSButton";
import MessageBubble from "./MessageBubble";
import ComposerPreview from "./ComposerPreview";
import ReasoningBlock from "./ReasoningBlock";
import { useChatStream, shouldConvertToAttachment } from "../hooks/useChatStream";
import { useBackgroundLoading } from "../hooks/useBackgroundLoading";
const cn = (...classes) => classes.filter(Boolean).join(" ");
export const ChatWindow = forwardRef(({ role, chatId, onMessageSent, className, headerClassName, bodyClassName, bodyInnerClassName, inputBarClassName, inputClassName, sendButtonClassName, userBubbleClassName, assistantBubbleClassName, showHeader = true, defaultAutoSpeak = false, onAutoSpeakChange, autoOpenLongCode = true, }, ref) => {
    // ✅ 使用统一的 hook，消除重复逻辑
    const { messages, input, setInput, isLoading, isLoadingHistory, autoSpeak, uploadedImages, textAttachments, inputCodeCards, collapsedMap, toggleCodeCard, expandedMap, toggleExpanded, send, cancelStream, stopSpeak, clearHistory, deleteMessage, handleAutoSpeakChange, fileInputRef, openFileDialog, handleImageUpload, removeImage, handlePastedText, handlePastedImages, removeTextAttachment, reasoningSteps, isReasoning, } = useChatStream({
        role,
        chatId,
        onMessageSent,
        defaultAutoSpeak,
        onAutoSpeakChange,
    });
    // ✅ 获取后台 loading 状态
    const { backgroundCount, hasBackgroundLoading } = useBackgroundLoading(role.id);
    const scrollRef = useRef(null);
    const containerRef = useRef(null);
    const textareaRef = useRef(null);
    // ✅ 本地 ready 状态：确保滚动完成后再显示消息，避免闪动
    // 初始为 false，等待历史加载和滚动完成后才设为 true
    const [isReady, setIsReady] = useState(false);
    // ✅ 跟踪当前 role.id，用于检测切换
    const prevRoleIdRef = useRef(role.id);
    // ✅ 当切换 agent 时（role.id 变化），立即重置 ready 状态
    useEffect(() => {
        if (prevRoleIdRef.current !== role.id) {
            setIsReady(false);
            prevRoleIdRef.current = role.id;
        }
    }, [role.id]);
    // ✅ 当开始加载时，立即设置为 not ready
    useEffect(() => {
        if (isLoadingHistory) {
            setIsReady(false);
        }
    }, [isLoadingHistory]);
    // ✅ 处理粘贴事件：支持文本附件和图片粘贴
    const handlePaste = useCallback(async (e) => {
        const clipboardData = e.clipboardData;
        // 1. 优先检查是否有图片
        const items = clipboardData.items;
        const imageItems = Array.from(items).filter(item => item.type.startsWith('image/'));
        if (imageItems.length > 0) {
            e.preventDefault(); // 阻止默认粘贴
            // 处理所有粘贴的图片
            const files = imageItems
                .map(item => item.getAsFile())
                .filter((file) => file !== null);
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
    }, [handlePastedText, handlePastedImages]);
    // 暴露给父组件的方法
    useImperativeHandle(ref, () => ({
        toggleAutoSpeak: () => handleAutoSpeakChange(!autoSpeak),
        stopSpeak,
        clearHistory,
    }), [stopSpeak, autoSpeak, handleAutoSpeakChange, clearHistory]);
    // 自动滚动到底部（仅在已 ready 时执行普通滚动）
    useEffect(() => {
        if (isReady && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages, isReady]);
    // ✅ 当历史加载完成时，先滚动到底部，再显示消息（避免闪动）
    useEffect(() => {
        // 只有当 isLoadingHistory 从 true 变为 false 且有消息时才执行
        if (!isLoadingHistory && !isReady) {
            if (messages.length === 0) {
                // 没有消息，直接显示
                setIsReady(true);
                return;
            }
            // 有消息时，先让消息渲染（但被隐藏），然后滚动到底部，最后显示
            // 使用 setTimeout 确保 DOM 已更新
            const prepareAndShow = () => {
                if (scrollRef.current) {
                    // 滚动到底部
                    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                }
                // 滚动完成后再显示消息
                requestAnimationFrame(() => {
                    if (scrollRef.current) {
                        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
                    }
                    // 延迟一点再显示，确保滚动已完成
                    setTimeout(() => {
                        setIsReady(true);
                    }, 50);
                });
            };
            // 给 DOM 一点时间来渲染隐藏的消息
            requestAnimationFrame(prepareAndShow);
        }
    }, [isLoadingHistory, isReady, messages.length]);
    // 自动调整 textarea 高度
    useEffect(() => {
        const textarea = textareaRef.current;
        if (!textarea)
            return;
        textarea.style.height = "auto";
        const newHeight = Math.min(Math.max(textarea.scrollHeight, 40), 200);
        textarea.style.height = `${newHeight}px`;
    }, [input]);
    return (_jsxs("div", { className: cn("flex h-full min-w-0 flex-col", className), children: [hasBackgroundLoading && (_jsxs("div", { className: "shrink-0 px-4 py-2 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-100 dark:border-blue-800/50 flex items-center gap-2 text-sm text-blue-700 dark:text-blue-300", children: [_jsx(Loader2, { size: 14, className: "animate-spin" }), _jsxs("span", { children: [backgroundCount, " \u4E2A\u5176\u4ED6 Agent \u6B63\u5728\u540E\u53F0\u601D\u8003\u4E2D\uFF0C\u5207\u6362\u56DE\u53BB\u53EF\u67E5\u770B\u54CD\u5E94"] })] })), showHeader && (_jsx("div", { className: cn("shrink-0 px-4 py-3", headerClassName), children: _jsxs("div", { className: "flex items-center justify-between gap-3", children: [_jsxs("div", { className: "min-w-0", children: [_jsx("div", { className: "font-semibold truncate", children: role.name }), _jsx("div", { className: "text-xs opacity-70", children: "Online" })] }), _jsxs("div", { className: "flex items-center gap-2 shrink-0", children: [_jsx("button", { type: "button", onClick: () => handleAutoSpeakChange(!autoSpeak), className: cn("p-2 rounded-full transition-colors", autoSpeak
                                        ? "bg-blue-500/20 text-blue-400 hover:bg-blue-500/30"
                                        : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200"), title: autoSpeak ? "关闭自动朗读" : "开启自动朗读", "aria-label": autoSpeak ? "关闭自动朗读" : "开启自动朗读", children: autoSpeak ? _jsx(Volume2, { size: 20 }) : _jsx(VolumeX, { size: 20 }) }), autoSpeak && (_jsx("button", { type: "button", onClick: stopSpeak, className: "p-2 rounded-full text-slate-400 hover:bg-red-500/20 hover:text-red-400 transition-colors", title: "\u505C\u6B62\u6717\u8BFB", "aria-label": "\u505C\u6B62\u6717\u8BFB", children: _jsx(Square, { size: 18, fill: "currentColor" }) })), _jsx("button", { type: "button", onClick: clearHistory, className: "text-xs px-2 py-1 rounded-md ring-1 ring-current/20 opacity-60 hover:opacity-100 transition", title: "Clear History", children: "\u6E05\u7A7A\u5386\u53F2" }), _jsxs("div", { className: "text-xs opacity-60", children: [messages.length, " msgs"] })] })] }) })), _jsxs("div", { ref: scrollRef, className: cn("flex-1 overflow-y-auto px-4 py-4", bodyClassName), children: [_jsx("div", { ref: containerRef, className: "w-full", style: { minHeight: '100%' }, children: _jsxs("div", { className: cn("mx-auto w-full max-w-3xl space-y-1", bodyInnerClassName), children: [isLoadingHistory && (_jsx("div", { className: "flex items-center justify-center py-8", children: _jsxs("div", { className: "flex items-center gap-3 text-slate-500 dark:text-slate-400", children: [_jsx(Loader2, { className: "animate-spin", size: 20 }), _jsx("span", { children: "\u52A0\u8F7D\u5386\u53F2\u6D88\u606F\u4E2D..." })] }) })), !isLoadingHistory && (_jsx("div", { style: { visibility: isReady ? 'visible' : 'hidden' }, children: messages.length === 0 ? (_jsxs("div", { className: "flex flex-col items-center justify-center py-12 gap-4", children: [role.avatar ? (_jsx("img", { src: role.avatar, alt: role.name, className: "w-16 h-16 rounded-full object-cover ring-2 ring-slate-300 dark:ring-slate-700/50" })) : (_jsx("div", { className: "w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white text-2xl font-bold", children: role.name.charAt(0).toUpperCase() })), _jsx("div", { className: "text-center", children: _jsxs("div", { className: "text-sm text-slate-500 dark:text-slate-400", children: ["\u548C ", _jsx("span", { className: "font-medium text-slate-800 dark:text-slate-100", children: role.name }), " \u5F00\u59CB\u5BF9\u8BDD"] }) }), _jsx("div", { className: "flex flex-wrap justify-center gap-2 mt-2 max-w-md", children: ["你好，介绍一下你自己", "你能做什么？", "帮我写一段代码"].map((prompt) => (_jsx("button", { type: "button", onClick: () => { setInput(prompt); }, className: "text-xs px-3 py-1.5 rounded-full border border-slate-300 dark:border-slate-700/60 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 hover:border-slate-400 dark:hover:border-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800/50 transition-all", children: prompt }, prompt))) })] })) : (_jsxs(_Fragment, { children: [messages.map((msg, index) => {
                                                // 检查是否需要在这条消息后显示推理块
                                                // 条件：当前是用户消息，且是最后一条消息或下一条是正在生成的 AI 回复
                                                const isLastUserMsg = msg.role === "user" && (index === messages.length - 1 ||
                                                    (index === messages.length - 2 && messages[index + 1]?.role === "assistant" && messages[index + 1]?.id.startsWith("assistant-")));
                                                const showReasoningAfter = isLastUserMsg && (isReasoning || reasoningSteps.length > 0);
                                                return (_jsxs(React.Fragment, { children: [_jsx(MessageBubble, { msg: msg, role: role, userBubbleClassName: userBubbleClassName, assistantBubbleClassName: assistantBubbleClassName, expanded: !!expandedMap[msg.id], onToggleExpandedById: toggleExpanded, autoOpenLongCode: autoOpenLongCode, onDelete: deleteMessage }), showReasoningAfter && (_jsx("div", { className: "flex justify-start", children: _jsx("div", { className: "w-full", children: _jsx(ReasoningBlock, { steps: reasoningSteps, isLoading: isReasoning }) }) }))] }, msg.id));
                                            }), isLoading &&
                                                !messages.some((m) => m.role === "assistant" && m.id.startsWith("assistant-")) && (_jsx("div", { className: "flex justify-start", children: _jsx("div", { className: cn("rounded-2xl rounded-tl-md px-4 py-3", assistantBubbleClassName), children: _jsx(Loader2, { className: "animate-spin opacity-70", size: 18 }) }) }))] })) }))] }) }), _jsx(SelectionTTSButton, { containerRef: containerRef, roleConfig: {
                            voice: role?.voice,
                            speed: role?.speed,
                            pitch: role?.pitch,
                            style: role?.style,
                        } })] }), _jsx("div", { className: cn("shrink-0 px-4 py-4", inputBarClassName), children: _jsxs("div", { className: "mx-auto w-full max-w-[1100px]", children: [_jsx(ComposerPreview, { uploadedImages: uploadedImages, onRemoveImage: removeImage, codeCards: inputCodeCards, collapsedMap: collapsedMap, onToggleCodeCard: toggleCodeCard, textAttachments: textAttachments, onRemoveTextAttachment: removeTextAttachment }), _jsxs("div", { className: cn("relative flex items-end gap-2 rounded-2xl px-3 py-2", inputClassName), children: [_jsx("input", { ref: fileInputRef, type: "file", accept: "image/*", multiple: true, onChange: handleImageUpload, className: "hidden", "aria-label": "\u4E0A\u4F20\u56FE\u7247" }), _jsx("div", { className: "flex items-center pb-2", children: _jsx("button", { type: "button", onClick: openFileDialog, disabled: isLoading, className: "p-2 rounded-full hover:bg-slate-800/50 transition-colors text-slate-400 hover:text-slate-200 disabled:opacity-50 disabled:cursor-not-allowed", title: "\u4E0A\u4F20\u56FE\u7247", "aria-label": "\u9009\u62E9\u8981\u4E0A\u4F20\u7684\u56FE\u7247", children: _jsx(Plus, { size: 20 }) }) }), _jsx("textarea", { ref: textareaRef, value: input, onChange: (e) => setInput(e.target.value), onPaste: handlePaste, onKeyDown: (e) => {
                                        if (e.key === "Enter" && !e.shiftKey) {
                                            e.preventDefault();
                                            send();
                                        }
                                    }, placeholder: `Message ${role.name}...`, className: "flex-1 resize-none bg-transparent text-base outline-none min-h-[40px] max-h-[200px] py-2 text-slate-800 dark:text-slate-100 placeholder:text-slate-400", style: { height: "40px" } }), _jsx("div", { className: "pb-2", children: isLoading ? (_jsx("button", { type: "button", onClick: cancelStream, className: cn("w-9 h-9 rounded-full inline-flex items-center justify-center transition-all", "bg-red-600/80 hover:bg-red-500 text-white hover:scale-105", sendButtonClassName), title: "\u505C\u6B62\u751F\u6210", "aria-label": "\u505C\u6B62\u751F\u6210", children: _jsx(Square, { size: 16, fill: "currentColor" }) })) : (_jsx("button", { type: "button", onClick: send, disabled: !input.trim() && uploadedImages.length === 0 && textAttachments.length === 0, className: cn("w-9 h-9 rounded-full inline-flex items-center justify-center transition-all", "disabled:opacity-50 disabled:cursor-not-allowed", !input.trim() && uploadedImages.length === 0 && textAttachments.length === 0
                                            ? "bg-slate-700 text-slate-400"
                                            : "bg-blue-600 hover:bg-blue-500 text-white hover:scale-105", sendButtonClassName), title: "\u53D1\u9001", "aria-label": "\u53D1\u9001\u6D88\u606F", children: _jsx(ArrowUp, { size: 20, strokeWidth: 2.5 }) })) })] })] }) })] }));
});
