
// src/components/MessageBubble.tsx
import React, { useMemo } from "react";
import { Message, Role } from "../types";
import AssistantMessageContent from "./AssistantMessageContent";
import {
    DEFAULT_THRESHOLDS,
    previewText,
    stripAllFencedCodes,
} from "../utils/codeSegmentation";

const cn = (...classes: Array<string | false | null | undefined>) =>
    classes.filter(Boolean).join(" ");

function shouldCollapseMessage(text: string) {
    const nonCodeLen = stripAllFencedCodes(text).length;
    const collapse = nonCodeLen >= DEFAULT_THRESHOLDS.TEXT_CHAR_THRESHOLD;
    return { collapse, nonCodeLen };
}

export default function MessageBubble(props: {
    msg: Message;
    role: Role;
    userBubbleClassName?: string;
    assistantBubbleClassName?: string;
    expanded: boolean;
    onToggleExpanded: () => void;
    autoOpenLongCode?: boolean;
}) {
    const {
        msg,
        role,
        userBubbleClassName,
        assistantBubbleClassName,
        expanded,
        onToggleExpanded,
        autoOpenLongCode = true,
    } = props;

    const isUser = msg.role === "user";
    const { collapse, nonCodeLen } = shouldCollapseMessage(msg.content);

    const collapsedPreview = useMemo(
        () => previewText(stripAllFencedCodes(msg.content), 260),
        [msg.content]
    );

    return (
        <div className={cn("flex", isUser ? "justify-end" : "justify-start")}>
            <div
                className={cn(
                    "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                    isUser
                        ? cn("rounded-tr-md", userBubbleClassName)
                        : cn("rounded-tl-md", assistantBubbleClassName)
                )}
            >
                {!collapse ? (
                    isUser ? (
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                    ) : (
                        <AssistantMessageContent
                            msgId={msg.id}
                            roleName={role.name}
                            text={msg.content}
                            autoOpenLongCode={autoOpenLongCode}
                        />
                    )
                ) : (
                    <div className="w-full">
                        <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="text-xs text-slate-300/80">
                                长消息 · {nonCodeLen} 字符（不含代码）
                            </div>
                            <button
                                type="button"
                                onClick={onToggleExpanded}
                                className="text-xs px-2 py-1 rounded-md bg-slate-800/50 hover:bg-slate-800 ring-1 ring-white/10 transition"
                            >
                                {expanded ? "收起" : "展开"}
                            </button>
                        </div>

                        {!expanded ? (
                            <div className="text-sm text-slate-200/90 whitespace-pre-wrap break-words">
                                {collapsedPreview}
                            </div>
                        ) : isUser ? (
                            <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        ) : (
                            <AssistantMessageContent
                                msgId={msg.id}
                                roleName={role.name}
                                text={msg.content}
                                autoOpenLongCode={autoOpenLongCode}
                            />
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
