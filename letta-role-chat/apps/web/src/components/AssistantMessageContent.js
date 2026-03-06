import { jsx as _jsx, Fragment as _Fragment } from "react/jsx-runtime";
// src/components/AssistantMessageContent.tsx
import { useEffect, useMemo } from "react";
import Markdown from "./Markdown";
import CodeArtifactCard from "./CodeArtifactCard";
import { DEFAULT_THRESHOLDS, segmentMessageByCodeBlocks, } from "../utils/codeSegmentation";
import { openArtifact } from "../utils/artifactBridge";
// 使用全局 Set + localStorage 存储已打开的代码块 key，避免组件重新挂载时重复打开
const OPENED_KEYS_STORAGE = "openedLongCodeKeys";
const openedKeysGlobal = new Set(JSON.parse(localStorage.getItem(OPENED_KEYS_STORAGE) || "[]"));
function markKeyAsOpened(key) {
    if (openedKeysGlobal.has(key))
        return false;
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
export default function AssistantMessageContent(props) {
    const { msgId, roleName, text, autoOpenLongCode = true } = props;
    const segments = useMemo(() => segmentMessageByCodeBlocks(text, DEFAULT_THRESHOLDS), [text]);
    useEffect(() => {
        if (!autoOpenLongCode)
            return;
        for (const seg of segments) {
            if (seg.type !== "longCode")
                continue;
            const key = `${msgId}#${seg.block.index}`;
            if (!markKeyAsOpened(key))
                continue; // 已打开过，跳过
            // 传递 agentName，让 CodePanelProvider 自动从代码中提取 title
            openArtifact(roleName, seg.block.language, seg.block.code);
        }
    }, [segments, msgId, roleName, autoOpenLongCode]);
    return (_jsx(_Fragment, { children: segments.map((seg, i) => {
            if (seg.type === "markdown") {
                return (_jsx(Markdown, { text: seg.content, className: "\r\n                prose prose-slate dark:prose-invert break-words max-w-none\r\n                prose-headings:mt-4 prose-headings:mb-2\r\n                prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg\r\n                prose-p:my-2 prose-p:text-base\r\n                prose-ul:my-2 prose-ol:my-2\r\n                prose-li:my-1\r\n                prose-li:leading-relaxed\r\n                [&_.prose_li>p]:my-0\r\n                [&_.prose_li>p]:leading-relaxed\r\n              " }, `md-${i}`));
            }
            const b = seg.block;
            return (_jsx(CodeArtifactCard, { title: `${roleName}-snippet-${b.index}`, language: b.language, lines: b.lines, chars: b.chars, onOpen: () => openArtifact(roleName, b.language, b.code) }, `lc-${i}`));
        }) }));
}
