
// src/components/AssistantMessageContent.tsx
import React, { useEffect, useMemo } from "react";
import Markdown from "./Markdown";
import CodeArtifactCard from "./CodeArtifactCard";
import {
    DEFAULT_THRESHOLDS,
    RenderSegment,
    segmentMessageByCodeBlocks,
} from "../utils/codeSegmentation";
import { openArtifact } from "../utils/artifactBridge";

// 使用全局 Set + localStorage 存储已打开的代码块 key，避免组件重新挂载时重复打开
const OPENED_KEYS_STORAGE = "openedLongCodeKeys";
const openedKeysGlobal: Set<string> = new Set(
    JSON.parse(localStorage.getItem(OPENED_KEYS_STORAGE) || "[]")
);

function markKeyAsOpened(key: string) {
    if (openedKeysGlobal.has(key)) return false;
    openedKeysGlobal.add(key);
    // 限制存储数量，避免无限增长（保留最近 500 个）
    if (openedKeysGlobal.size > 500) {
        const arr = Array.from(openedKeysGlobal);
        arr.splice(0, arr.length - 500);
        openedKeysGlobal.clear();
        arr.forEach((k) => openedKeysGlobal.add(k));
    }
    localStorage.setItem(OPENED_KEYS_STORAGE, JSON.stringify(Array.from(openedKeysGlobal)));
    return true;
}

export default function AssistantMessageContent(props: {
    msgId: string;
    roleName: string;
    text: string;
    autoOpenLongCode?: boolean; // 默认 true
}) {
    const { msgId, roleName, text, autoOpenLongCode = true } = props;

    const segments: RenderSegment[] = useMemo(
        () => segmentMessageByCodeBlocks(text, DEFAULT_THRESHOLDS),
        [text]
    );

    useEffect(() => {
        if (!autoOpenLongCode) return;

        for (const seg of segments) {
            if (seg.type !== "longCode") continue;
            const key = `${msgId}#${seg.block.index}`;
            if (!markKeyAsOpened(key)) continue; // 已打开过，跳过

            openArtifact(`${roleName}-code-${seg.block.index}`, seg.block.language, seg.block.code);
        }
    }, [segments, msgId, roleName, autoOpenLongCode]);

    return (
        <>
            {segments.map((seg, i) => {
                if (seg.type === "markdown") {
                    return (
                        <Markdown
                            key={`md-${i}`}
                            text={seg.content}
                            className="
                prose prose-slate dark:prose-invert break-words max-w-none
                prose-headings:mt-4 prose-headings:mb-2
                prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
                prose-p:my-2 prose-p:text-base
                prose-ul:my-2 prose-ol:my-2
                prose-li:my-1
                prose-li:leading-relaxed
                [&_.prose_li>p]:my-0
                [&_.prose_li>p]:leading-relaxed
              "
                        />
                    );
                }

                const b = seg.block;
                return (
                    <CodeArtifactCard
                        key={`lc-${i}`}
                        title={`${roleName}-snippet-${b.index}`}
                        language={b.language}
                        lines={b.lines}
                        chars={b.chars}
                        onOpen={() => openArtifact(`${roleName}-code-${b.index}`, b.language, b.code)}
                    />
                );
            })}
        </>
    );
}
