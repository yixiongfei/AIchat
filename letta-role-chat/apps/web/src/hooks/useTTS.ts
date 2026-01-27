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
};

type CacheEntry = {
  url: string;
  expiresAt: number;
};

// ========================================
// 智能分段工具函数
// ========================================

// ✅ 计算有效内容长度（去除所有空白符）
function getEffectiveLength(text: string): number {
  return text.replace(/\s/g, '').length;
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

  // 太短，继续等待
  if (effectiveLen < minLength) {
    return { shouldSend: false, reason: 'too_short' };
  }

  // 超长，强制发送
  if (effectiveLen >= maxLength) {
    return { shouldSend: true, reason: 'max_length' };
  }

  // ✅ 优先级1：检查是否包含段落分隔符 \n\n
  if (trimmed.includes('\n\n')) {
    return { shouldSend: true, reason: 'paragraph_separator' };
  }

  // ✅ 优先级2：检查是否包含完整句子标点（句号、问号、感叹号）
  // 这是最重要的分段依据，优先级最高
  if (/[。！？.!?…]+/.test(trimmed) && effectiveLen >= sentenceLength) {
    return { shouldSend: true, reason: 'sentence_end' };
  }

  // ✅ 优先级3：检查是否包含逗号、顿号、分号（需要更长的长度）
  if (/[，、；,;]+/.test(trimmed) && effectiveLen >= pauseLength) {
    return { shouldSend: true, reason: 'comma_pause' };
  }

  // 继续等待更多内容
  return { shouldSend: false, reason: 'waiting' };
}

// ✅ 核心函数：从缓冲区提取第一个完整分段
// 关键改进：优先级严格按照 段落 > 句子 > 逗号，移除冒号分割，避免引号问题
function extractSegment(buffer: string): [string, string] {
  const trimmed = buffer.trim();
  
  // ✅ 优先级1：按段落分隔符 \n\n 分割
  const paragraphIdx = trimmed.indexOf('\n\n');
  if (paragraphIdx !== -1) {
    const segment = trimmed.slice(0, paragraphIdx).trim();
    const remaining = trimmed.slice(paragraphIdx + 2).trim();
    return [segment, remaining];
  }

  // ✅ 优先级2：按完整句子分割（句号、问号、感叹号）
  // 这是最关键的分段点，确保完整句子不被打断
  const sentenceMatch = trimmed.match(/(.*?[。！？.!?…]+)/);
  if (sentenceMatch) {
    const segment = sentenceMatch[1].trim();
    const remaining = trimmed.slice(sentenceMatch[1].length).trim();
    return [segment, remaining];
  }

  // ✅ 优先级3：按逗号、顿号、分号分割（需要足够长度，避免过度碎片化）
  const effectiveLen = getEffectiveLength(trimmed);
  if (effectiveLen >= 50) { // 提高阈值，避免过早分割
    const pauseMatch = trimmed.match(/(.*?[，、；,;]+)/);
    if (pauseMatch) {
      const segment = pauseMatch[1].trim();
      const remaining = trimmed.slice(pauseMatch[1].length).trim();
      return [segment, remaining];
    }
  }

  // ✅ 没有找到合适的分割点，返回全部内容
  return [trimmed, ''];
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

  // ✅ 流式分段缓冲区
  const streamBufferRef = useRef<{ buffer: string; timer: number | null }>({
    buffer: '',
    timer: null,
  });

  const CACHE_TTL_MS = 60 * 60 * 1000; // 1小时
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
      const firstKey = cache.keys().next().value;
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

    // 中止所有进行中的请求
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

    // ✅ 清理流式缓冲区
    if (streamBufferRef.current.timer) {
      window.clearTimeout(streamBufferRef.current.timer);
      streamBufferRef.current.timer = null;
    }
    streamBufferRef.current.buffer = '';
  }, []);

  const getOrCreateAudioUrl = useCallback(async (message: string, cfg: RoleTTSConfig, signal: AbortSignal) => {
    pruneCache();

    const key = buildCacheKey(message, cfg);
    const now = Date.now();

    // 命中缓存
    const cached = audioUrlCacheRef.current.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.url;
    }

    // 并发去重：如果已经有相同请求在进行中，直接等待
    const inFlight = inFlightRef.current.get(key);
    if (inFlight) {
      return await inFlight;
    }

    // 发起新请求
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

      // 写入缓存
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
      // 无论成功失败，都要移除 inFlight 标记
      inFlightRef.current.delete(key);
    }
  }, []);

  const enqueue = useCallback(async (message: string, opts: EnqueueOptions = {}) => {
    if (!message?.trim()) return;

    const seq = ++ttsSeqRef.current;
    const myGen = generationRef.current;

    const controller = new AbortController();
    controllersRef.current.set(seq, controller);

    try {
      const base = configRef.current;
      const cfg: RoleTTSConfig = {
        voice: opts.voice ?? base.voice,
        speed: opts.speed ?? base.speed,
        pitch: opts.pitch ?? base.pitch,
        style: opts.style ?? base.style,
      };

      const audioUrl = await getOrCreateAudioUrl(message, cfg, controller.signal);

      // 如果期间被 stop 了，丢弃
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
  }, [getOrCreateAudioUrl, tryPlayNext, markSeqFailedAndContinue]);

  // ========================================
  // ✅ 流式追加接口（智能分段）
  // ========================================
  const appendStream = useCallback((chunk: string, opts?: {
    minLength?: number;
    sentenceLength?: number;
    maxLength?: number;
    pauseLength?: number;
    debounceMs?: number;
  }) => {
    const {
      minLength = 15,
      sentenceLength = 20,    // 降低句子长度要求，让完整句子更快发送
      maxLength = 150,
      pauseLength = 50,        // 提高逗号分割的长度要求
      debounceMs = 500,        // 适当延长防抖时间，等待完整句子
    } = opts || {};

    // ✅ 追加新内容到缓冲区
    streamBufferRef.current.buffer += chunk;
    // console.log("chunk:", JSON.stringify(chunk));
    // console.log("buffer(before):", JSON.stringify(streamBufferRef.current.buffer.slice(-80)));

    // ✅ 判断是否应该发送
    const decision = shouldSendTTSSegment(streamBufferRef.current.buffer, {
      minLength,
      sentenceLength,
      maxLength,
      pauseLength,
    });

    if (decision.shouldSend) {
      // ✅ 提取第一个完整分段
      const [toSend, remaining] = extractSegment(streamBufferRef.current.buffer);
      streamBufferRef.current.buffer = remaining;

      // 清除防抖定时器
      if (streamBufferRef.current.timer) {
        window.clearTimeout(streamBufferRef.current.timer);
        streamBufferRef.current.timer = null;
      }

      if (toSend) {
        console.log(`[TTS Stream] ${decision.reason}: "${toSend.substring(0, 50)}${toSend.length > 50 ? '...' : ''}"`);
        enqueue(toSend);
      }
    } else {
      // ✅ 防抖：等待更多内容到达
      if (streamBufferRef.current.timer) {
        window.clearTimeout(streamBufferRef.current.timer);
      }

      streamBufferRef.current.timer = window.setTimeout(() => {
        const [toSend, remaining] = extractSegment(streamBufferRef.current.buffer);
        streamBufferRef.current.buffer = remaining;
        streamBufferRef.current.timer = null;

        if (toSend) {
          console.log(`[TTS Stream] timeout_flush: "${toSend.substring(0, 50)}${toSend.length > 50 ? '...' : ''}"`);
          enqueue(toSend);
        }
      }, debounceMs);
    }
  }, [enqueue]);

  // ========================================
  // ✅ 刷新缓冲区（流式结束时调用）
  // ========================================
  const flushStream = useCallback(async () => {
    if (streamBufferRef.current.timer) {
      window.clearTimeout(streamBufferRef.current.timer);
      streamBufferRef.current.timer = null;
    }

    const remaining = streamBufferRef.current.buffer.trim();
    streamBufferRef.current.buffer = '';

    if (remaining) {
      console.log(`[TTS Stream] flush_remaining: "${remaining.substring(0, 50)}${remaining.length > 50 ? '...' : ''}"`);
      await enqueue(remaining);
    }
  }, [enqueue]);

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { 
    enqueue,      // 直接入队完整文本
    appendStream, // 流式追加（自动分段）
    flushStream,  // 刷新剩余缓冲
    stop,         // 停止播放
  } as const;
}