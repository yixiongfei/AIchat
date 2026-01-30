
// src/utils/codeSegmentation.ts

export type CodeBlock = {
  language: string;
  code: string;
  lines: number;
  chars: number;
  index: number; // 第几个 code block（从 1 开始）
};

export type RenderSegment =
  | { type: "markdown"; content: string }
  | { type: "longCode"; block: CodeBlock };

export const DEFAULT_THRESHOLDS = {
  CODE_LINE_THRESHOLD: 30,
  CODE_CHAR_THRESHOLD: 1200,
  TEXT_CHAR_THRESHOLD: 2000,
};

export function isLongCode(
  lines: number,
  chars: number,
  thresholds = DEFAULT_THRESHOLDS
) {
  return (
    lines >= thresholds.CODE_LINE_THRESHOLD ||
    chars >= thresholds.CODE_CHAR_THRESHOLD
  );
}

/**
 * 将消息拆分为：
 * - markdown 段（包含文本 + 短代码 fenced block）
 * - longCode 段（长代码块，单独输出给侧边栏）
 */
export function segmentMessageByCodeBlocks(
  text: string,
  thresholds = DEFAULT_THRESHOLDS
): RenderSegment[] {
  const re = /```(\w+)?\n([\s\S]*?)```/g;

  let lastIndex = 0;
  let codeIndex = 0;
  let mdBuffer = "";

  const segs: RenderSegment[] = [];
  let m: RegExpExecArray | null;

  while ((m = re.exec(text)) !== null) {
    const start = m.index;
    const end = re.lastIndex;

    // 追加 code 前的文本
    if (start > lastIndex) mdBuffer += text.slice(lastIndex, start);

    codeIndex += 1;
    const language = (m[1] ?? "text").toLowerCase();
    const code = m[2] ?? "";
    const lines = code.split("\n").length;
    const chars = code.length;

    if (isLongCode(lines, chars, thresholds)) {
      // 输出已有 markdown
      if (mdBuffer.length > 0) segs.push({ type: "markdown", content: mdBuffer });
      mdBuffer = "";

      // 输出长代码段
      segs.push({
        type: "longCode",
        block: { language, code, lines, chars, index: codeIndex },
      });
    } else {
      // 短代码：保留在 markdown 中
      mdBuffer += `\`\`\`${language}\n${code}\`\`\``;
    }

    lastIndex = end;
  }

  // 追加末尾文本
  if (lastIndex < text.length) mdBuffer += text.slice(lastIndex);

  if (mdBuffer.length > 0) segs.push({ type: "markdown", content: mdBuffer });

  return mergeAdjacentMarkdown(segs);
}

function mergeAdjacentMarkdown(segs: RenderSegment[]): RenderSegment[] {
  const out: RenderSegment[] = [];
  for (const s of segs) {
    const prev = out[out.length - 1];
    if (prev && prev.type === "markdown" && s.type === "markdown") {
      prev.content += s.content;
    } else {
      out.push(s);
    }
  }
  return out;
}

/** 去掉所有 fenced code，用于“折叠长度判断/预览” */
export function stripAllFencedCodes(text: string) {
  return text.replace(/```[\s\S]*?```/g, "");
}

export function previewText(text: string, maxChars = 240) {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= maxChars) return t;
  return t.slice(0, maxChars) + "…";
}
