
// src/components/AssistantMessageContent.tsx
import React, { useEffect, useMemo, useRef } from "react";
import Markdown from "./Markdown";
import CodeArtifactCard from "./CodeArtifactCard";
import {
    DEFAULT_THRESHOLDS,
    RenderSegment,
    segmentMessageByCodeBlocks,
} from "../utils/codeSegmentation";
import { openArtifact } from "../utils/artifactBridge";

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

    // 避免流式渲染过程中重复弹出
    const openedRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        if (!autoOpenLongCode) return;

        for (const seg of segments) {
            if (seg.type !== "longCode") continue;
            const key = `${msgId}#${seg.block.index}`;
            if (openedRef.current.has(key)) continue;

            openedRef.current.add(key);
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
                prose prose-invert break-words
                prose-headings:mt-4 prose-headings:mb-2
                prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
                prose-p:my-2
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
