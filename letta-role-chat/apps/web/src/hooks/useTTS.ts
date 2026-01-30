
import { useEffect, useRef, useCallback } from "react";

export type RoleTTSConfig = {
  voice?: string;
  speed?: number;
  pitch?: string;
  style?: string;
};

type EnqueueOptions = {
  voice?: string;
  speed?: number;
  pitch?: string;
  style?: string;
  /** 是否对文本做净化（去代码等），默认 true */
  sanitize?: boolean;
};

type CacheEntry = {
  url: string;
  expiresAt: number;
};

// ========================================
// 文字净化（非流式 / 最终兜底）：只保留可朗读文字
// ========================================

function sanitizeForTTS(markdown: string) {
  if (!markdown) return "";

  let s = markdown;

  // ---------- 1) 去代码 ----------
  // fenced code blocks
  s = s.replace(/```[\s\S]*?```/g, " ");
  // inline code
  s = s.replace(/`[^`]*`/g, " ");

  // ---------- 2) 图片/链接 ----------
  // image: ![alt](url) -> alt
  s = s.replace(/!\[([^\]]*)\]\([^)]+\)/g, "$1");
  // link: [text](url) -> text
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1");
  // autolink: <https://...> -> (删掉尖括号，仅留 URL 或可选择删掉 URL)
  s = s.replace(/<((https?:\/\/|mailto:)[^>]+)>/g, "$1");

  // ---------- 3) 标题/引用/列表 ----------
  // headings: ### Title -> Title
  s = s.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  // blockquote: > text -> text
  s = s.replace(/^\s{0,3}>\s?/gm, "");
  // unordered list: - item / * item / + item -> item
  s = s.replace(/^\s*[-*+]\s+/gm, "");
  // ordered list: 1. item -> item
  s = s.replace(/^\s*\d+\.\s+/gm, "");

  // ---------- 4) 强调/删除线（保留文字，去符号） ----------
  // bold: **text** or __text__
  s = s.replace(/\*\*([^*]+)\*\*/g, "$1");
  s = s.replace(/__([^_]+)__/g, "$1");
  // italic: *text* or _text_
  // 注意：避免把下划线当作普通字符误伤，这里做保守匹配
  s = s.replace(/\*([^*\n]+)\*/g, "$1");
  s = s.replace(/_([^_\n]+)_/g, "$1");
  // strikethrough: ~~text~~
  s = s.replace(/~~([^~]+)~~/g, "$1");

  // ---------- 5) 表格/分隔线 ----------
  // 去掉表格分隔行: | --- | --- |
  s = s.replace(/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/gm, " ");
  // 表格竖线 -> 空格（保留单元格内容）
  s = s.replace(/\|/g, " ");

  // horizontal rule: --- / *** / ___
  s = s.replace(/^\s*([-*_])\1{2,}\s*$/gm, " ");

  // ---------- 6) 去 HTML 标签 ----------
  s = s.replace(/<\/?[^>]+>/g, " ");

  // ---------- 7) 处理常见 HTML 实体 ----------
  s = s
    .replace(/&nbsp;?/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

  // ---------- 8) 清理残留的 Markdown 噪声符号（保守） ----------
  // 避免把中文标点清掉；这里只清理常见语法符号
  s = s.replace(/[()[\]{}]/g, " ");      // 括号类（主要是 markdown 残留）
  s = s.replace(/[*#~`]/g, " ");         // 星号/井号/波浪/反引号

  // ---------- 9) 压缩空白 ----------
  s = s.replace(/\s+/g, " ").trim();

  return s;
}

// ========================================
// ✅ 重叠去重：解决 chunk 不是纯 delta 时的重复朗读
// ========================================
function trimOverlap(prevTail: string, nextChunk: string, maxCheck = 160) {
  if (!prevTail || !nextChunk) return nextChunk;

  const tail = prevTail.slice(-maxCheck);
  const max = Math.min(tail.length, nextChunk.length);

  // 找最大重叠：tail 的后缀 == chunk 的前缀
  for (let k = max; k >= 1; k--) {
    if (tail.slice(-k) === nextChunk.slice(0, k)) {
      return nextChunk.slice(k);
    }
  }
  return nextChunk;
}

// ========================================
// 流式：Markdown 代码过滤器（跨 chunk 状态机）
// - 过滤 ``` fenced code ```
// - 过滤 `inline code`
// ========================================
type FilterState = {
  mode: "text" | "inline" | "fence";
  tickRun: number;      // 连续反引号计数（跨 chunk）
  fenceHeader: boolean; // 刚进入 fence 后，忽略语言行直到 '\n'
};

function createMarkdownCodeFilter() {
  const st: FilterState = { mode: "text", tickRun: 0, fenceHeader: false };

  const reset = () => {
    st.mode = "text";
    st.tickRun = 0;
    st.fenceHeader = false;
  };

  const feed = (chunk: string) => {
    if (!chunk) return "";
    let out = "";

    const flushTicks = () => {
      if (st.tickRun <= 0) return;

      if (st.mode === "text") {
        if (st.tickRun >= 3) {
          // 进入 fenced code
          st.mode = "fence";
          st.fenceHeader = true;
        } else if (st.tickRun === 1) {
          // 进入 inline code
          st.mode = "inline";
        } else {
          // 两个反引号：当字面符号处理
          out += "`".repeat(st.tickRun);
        }
      } else if (st.mode === "inline") {
        // inline 内遇到反引号：结束 inline
        st.mode = "text";
      } else {
        // fence 内：tickRun>=3 认为结束 fence
        if (st.tickRun >= 3) {
          st.mode = "text";
          st.fenceHeader = false;
        }
      }
      st.tickRun = 0;
    };

    for (let i = 0; i < chunk.length; i++) {
      const ch = chunk[i];

      if (ch === "`") {
        st.tickRun += 1;
        continue;
      }

      // 遇到非反引号，先处理累计的反引号
      flushTicks();

      // 刚进 fence：忽略 ```lang 直到换行
      if (st.mode === "fence" && st.fenceHeader) {
        if (ch === "\n") st.fenceHeader = false;
        continue;
      }

      // text 模式输出；inline/fence 忽略
      if (st.mode === "text") out += ch;
    }

    // chunk 结束，不 flush tickRun（留到下一 chunk 判断）
    return out;
  };

  return { feed, reset };
}

// ========================================
// 智能分段工具函数
// ========================================
function getEffectiveLength(text: string): number {
  return text.replace(/\s/g, "").length;
}

interface SegmentDecision {
  shouldSend: boolean;
  reason: string;
}

function shouldSendTTSSegment(
  buffer: string,
  config?: {
    minLength?: number;
    sentenceLength?: number;
    maxLength?: number;
    pauseLength?: number;
  }
): SegmentDecision {
  const {
    minLength = 15,
    sentenceLength = 25,
    maxLength = 500,
    pauseLength = 25,
  } = config || {};

  const trimmed = buffer.trim();
  const effectiveLen = getEffectiveLength(trimmed);

  if (effectiveLen < minLength) return { shouldSend: false, reason: "too_short" };
  if (effectiveLen >= maxLength) return { shouldSend: true, reason: "max_length" };

  // 段落分隔
  if (trimmed.includes("\n\n")) return { shouldSend: true, reason: "paragraph_separator" };

  // 句子结束（优先级最高）
  if (/[。！？.!?…]+/.test(trimmed) && effectiveLen >= sentenceLength) {
    return { shouldSend: true, reason: "sentence_end" };
  }

  // 逗号/顿号/分号（更长才触发）
  if (/[，、；,;]+/.test(trimmed) && effectiveLen >= pauseLength) {
    return { shouldSend: true, reason: "comma_pause" };
  }

  return { shouldSend: false, reason: "waiting" };
}

// 从缓冲区提取一个分段：段落 > 句子 > 逗号
function extractSegment(buffer: string): [string, string] {
  const trimmed = buffer.trim();

  const paragraphIdx = trimmed.indexOf("\n\n");
  if (paragraphIdx !== -1) {
    const segment = trimmed.slice(0, paragraphIdx).trim();
    const remaining = trimmed.slice(paragraphIdx + 2).trim();
    return [segment, remaining];
  }

  const sentenceMatch = trimmed.match(/(.*?[。！？.!?…]+)/);
  if (sentenceMatch) {
    const seg = sentenceMatch[1].trim();
    const remaining = trimmed.slice(sentenceMatch[1].length).trim();
    return [seg, remaining];
  }

  const effectiveLen = getEffectiveLength(trimmed);
  if (effectiveLen >= 50) {
    const pauseMatch = trimmed.match(/(.*?[，、；,;]+)/);
    if (pauseMatch) {
      const seg = pauseMatch[1].trim();
      const remaining = trimmed.slice(pauseMatch[1].length).trim();
      return [seg, remaining];
    }
  }

  return [trimmed, ""];
}

// ========================================
// useTTS Hook
// ========================================
export default function useTTS(roleConfig: RoleTTSConfig) {
  const audioQueueRef = useRef<Map<number, HTMLAudioElement>>(new Map());
  const isPlayingRef = useRef(false);
  const ttsSeqRef = useRef(0);
  const nextPlaySeqRef = useRef(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const configRef = useRef<RoleTTSConfig>(roleConfig);
  useEffect(() => {
    configRef.current = roleConfig;
  }, [roleConfig]);

  const generationRef = useRef(0);
  const controllersRef = useRef<Map<number, AbortController>>(new Map());

  // 缓存 & 并发去重
  const audioUrlCacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const inFlightRef = useRef<Map<string, Promise<string>>>(new Map());

  // 流式缓冲区
  const streamBufferRef = useRef<{ buffer: string; timer: number | null }>({
    buffer: "",
    timer: null,
  });

  // ✅ 流式代码过滤器（跨 chunk 状态）
  const codeFilterRef = useRef(createMarkdownCodeFilter());

  // ✅ (1) overlap 去重：记录最近输出的尾巴
  const lastTailRef = useRef<string>("");

  // ✅ (2) timer token：防止 debounce 竞态重复发送
  const timerTokenRef = useRef(0);

  const CACHE_TTL_MS = 60 * 60 * 1000;
  const CACHE_MAX = 200;

  const normalizeText = (s: string) => s.replace(/\s+/g, " ").trim();
  const buildCacheKey = (message: string, cfg: RoleTTSConfig) => {
    const text = normalizeText(message);
    const voice = cfg.voice ?? "";
    const speed = cfg.speed ?? "";
    const pitch = cfg.pitch ?? "";
    const style = cfg.style ?? "";
    return `${text}|v=${voice}|s=${speed}|p=${pitch}|st=${style}`;
  };

  const cleanupAudio = (a: HTMLAudioElement | null) => {
    if (!a) return;
    try { a.pause(); } catch {}
    try { a.src = ""; a.load(); } catch {}
    a.onended = null;
    a.onerror = null;
  };

  const pruneCache = () => {
    const now = Date.now();
    const cache = audioUrlCacheRef.current;

    for (const [k, v] of cache.entries()) {
      if (v.expiresAt <= now) cache.delete(k);
    }
    while (cache.size > CACHE_MAX) {
      const firstKey = cache.keys().next().value as string | undefined;
      if (!firstKey) break;
      cache.delete(firstKey);
    }
  };

  const tryPlayNext = useCallback(() => {
    if (isPlayingRef.current) return;
    const seq = nextPlaySeqRef.current;
    const audio = audioQueueRef.current.get(seq);
    if (!audio) return;

    audioQueueRef.current.delete(seq);
    isPlayingRef.current = true;
    audioRef.current = audio;

    const finish = () => {
      cleanupAudio(audioRef.current);
      audioRef.current = null;
      isPlayingRef.current = false;
      nextPlaySeqRef.current += 1;
      tryPlayNext();
    };

    audio.onended = finish;
    audio.onerror = finish;
    audio.preload = "auto";

    audio.play().catch((e) => {
      console.error("Audio play error:", e);
      finish();
    });
  }, []);

  const markSeqFailedAndContinue = useCallback((seq: number) => {
    if (seq === nextPlaySeqRef.current) {
      nextPlaySeqRef.current += 1;
      tryPlayNext();
    }
  }, [tryPlayNext]);

  const stop = useCallback(() => {
    generationRef.current += 1;

    for (const [, c] of controllersRef.current.entries()) {
      try { c.abort(); } catch {}
    }
    controllersRef.current.clear();

    cleanupAudio(audioRef.current);
    audioRef.current = null;

    for (const [, a] of audioQueueRef.current.entries()) cleanupAudio(a);
    audioQueueRef.current.clear();

    ttsSeqRef.current = 0;
    nextPlaySeqRef.current = 1;
    isPlayingRef.current = false;

    // 清理流式缓冲区
    if (streamBufferRef.current.timer) {
      window.clearTimeout(streamBufferRef.current.timer);
      streamBufferRef.current.timer = null;
    }
    streamBufferRef.current.buffer = "";

    // ✅ 重置过滤器/去重/令牌
    codeFilterRef.current.reset();
    lastTailRef.current = "";
    timerTokenRef.current += 1; // 让旧回调全部失效
  }, []);

  const getOrCreateAudioUrl = useCallback(
    async (message: string, cfg: RoleTTSConfig, signal: AbortSignal) => {
      pruneCache();

      const key = buildCacheKey(message, cfg);
      const now = Date.now();

      const cached = audioUrlCacheRef.current.get(key);
      if (cached && cached.expiresAt > now) return cached.url;

      const inFlight = inFlightRef.current.get(key);
      if (inFlight) return await inFlight;

      const p = (async () => {
        const resp = await fetch("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal,
          body: JSON.stringify({
            message,
            voice: cfg.voice,
            speed: cfg.speed,
            pitch: cfg.pitch,
            style: cfg.style,
          }),
        });

        if (!resp.ok) throw new Error("TTS request failed");
        const { fileName } = await resp.json();
        const url = `/api/tts/audio/${fileName}`;

        audioUrlCacheRef.current.set(key, {
          url,
          expiresAt: Date.now() + CACHE_TTL_MS,
        });

        return url;
      })();

      inFlightRef.current.set(key, p);
      try {
        return await p;
      } finally {
        inFlightRef.current.delete(key);
      }
    },
    []
  );

  const enqueue = useCallback(
    async (message: string, opts: EnqueueOptions = {}) => {
      if (!message?.trim()) return;

      const base = configRef.current;
      const cfg: RoleTTSConfig = {
        voice: opts.voice ?? base.voice,
        speed: opts.speed ?? base.speed,
        pitch: opts.pitch ?? base.pitch,
        style: opts.style ?? base.style,
      };

      // ✅ 默认净化：只读文字，不读代码
      const sanitize = opts.sanitize ?? true;
      const finalText = sanitize ? sanitizeForTTS(message) : message;
      if (!finalText.trim()) return;

      const seq = ++ttsSeqRef.current;
      const myGen = generationRef.current;
      const controller = new AbortController();
      controllersRef.current.set(seq, controller);

      try {
        const audioUrl = await getOrCreateAudioUrl(finalText, cfg, controller.signal);
        if (myGen !== generationRef.current) return;

        const audio = new Audio(audioUrl);
        audio.preload = "auto";
        audioQueueRef.current.set(seq, audio);
        tryPlayNext();
      } catch (error: any) {
        if (error?.name === "AbortError") {
          markSeqFailedAndContinue(seq);
          return;
        }
        console.error("TTS enqueue error:", error);
        markSeqFailedAndContinue(seq);
      } finally {
        controllersRef.current.delete(seq);
      }
    },
    [getOrCreateAudioUrl, tryPlayNext, markSeqFailedAndContinue]
  );

  // ========================================
  // ✅ 流式追加接口（智能分段 + 过滤代码 + overlap去重 + timer token）
  // ========================================
  const appendStream = useCallback(
    (
      chunk: string,
      opts?: {
        minLength?: number;
        sentenceLength?: number;
        maxLength?: number;
        pauseLength?: number;
        debounceMs?: number;
        filterCode?: boolean;
        debug?: boolean;
      }
    ) => {
      const {
        minLength = 15,
        sentenceLength = 20,
        maxLength = 150,
        pauseLength = 50,
        debounceMs = 500,
        filterCode = true,
        debug = false,
      } = opts || {};

      // 1) ✅ 过滤代码（支持跨 chunk）
      const filtered = filterCode ? codeFilterRef.current.feed(chunk) : chunk;
      if (!filtered) return;

      // 2) ✅ overlap 去重（防止服务端 chunk 重叠/重复）
      const deduped = trimOverlap(lastTailRef.current, filtered);
      if (!deduped) {
        // 仍要更新 tail（避免 tail 太旧），但 deduped 为空说明完全重叠
        lastTailRef.current = (lastTailRef.current + filtered).slice(-240);
        return;
      }
      lastTailRef.current = (lastTailRef.current + deduped).slice(-240);

      // 3) 写入 buffer
      streamBufferRef.current.buffer += deduped;

      const decision = shouldSendTTSSegment(streamBufferRef.current.buffer, {
        minLength,
        sentenceLength,
        maxLength,
        pauseLength,
      });

      if (decision.shouldSend) {
        // 立即发送：先提取 segment
        const [toSend, remaining] = extractSegment(streamBufferRef.current.buffer);
        streamBufferRef.current.buffer = remaining;

        // 清 timer + 让旧回调全部失效
        if (streamBufferRef.current.timer) {
          window.clearTimeout(streamBufferRef.current.timer);
          streamBufferRef.current.timer = null;
        }
        timerTokenRef.current += 1;

        const clean = sanitizeForTTS(toSend);
        if (clean) {
          if (debug) {
            console.log(
              `[TTS Stream] ${decision.reason}: "${clean.slice(0, 60)}${clean.length > 60 ? "..." : ""}"`
            );
          }
          enqueue(clean, { sanitize: false }); // 已净化，避免重复净化
        }
      } else {
        // debounce flush：token 防竞态
        if (streamBufferRef.current.timer) window.clearTimeout(streamBufferRef.current.timer);

        timerTokenRef.current += 1;
        const myToken = timerTokenRef.current;

        streamBufferRef.current.timer = window.setTimeout(() => {
          // ✅ 过期回调直接退出（避免 race 重复发送）
          if (myToken !== timerTokenRef.current) return;

          const [toSend, remaining] = extractSegment(streamBufferRef.current.buffer);
          streamBufferRef.current.buffer = remaining;
          streamBufferRef.current.timer = null;

          const clean = sanitizeForTTS(toSend);
          if (clean) {
            if (debug) {
              console.log(
                `[TTS Stream] timeout_flush: "${clean.slice(0, 60)}${clean.length > 60 ? "..." : ""}"`
              );
            }
            enqueue(clean, { sanitize: false });
          }
        }, debounceMs);
      }
    },
    [enqueue]
  );

  // ========================================
  // ✅ 刷新缓冲区（流式结束时调用）
  // ========================================
  const flushStream = useCallback(async () => {
    // 取消 timer + 失效 token
    if (streamBufferRef.current.timer) {
      window.clearTimeout(streamBufferRef.current.timer);
      streamBufferRef.current.timer = null;
    }
    timerTokenRef.current += 1;

    const remaining = streamBufferRef.current.buffer.trim();
    streamBufferRef.current.buffer = "";

    const clean = sanitizeForTTS(remaining);
    if (clean) {
      await enqueue(clean, { sanitize: false });
    }
  }, [enqueue]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return {
    enqueue,      // 入队（默认 sanitize：只读文字）
    appendStream, // 流式追加（默认 filterCode + overlap去重 + token）
    flushStream,
    stop,
  } as const;
}
