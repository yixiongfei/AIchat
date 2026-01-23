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

function endsWithCompleteSentence(text: string): boolean {
  return /[。！？.!?…]+\s*$/.test(text);
}

function endsWithPause(text: string): boolean {
  return /[，、；,;]+\s*$/.test(text);
}

function endsWithParagraph(text: string): boolean {
  return /[。！？.!?…]+\s*\n|(\n\s*){2,}/.test(text);
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
    minLength = 20,
    sentenceLength = 30,
    maxLength = 150,
    pauseLength = 60,
  } = config || {};

  const trimmed = buffer.trim();
  const len = trimmed.length;

  if (len < minLength) {
    return { shouldSend: false, reason: 'too_short' };
  }

  if (len >= maxLength) {
    return { shouldSend: true, reason: 'max_length' };
  }

  if (endsWithParagraph(trimmed)) {
    return { shouldSend: true, reason: 'paragraph_end' };
  }

  if (endsWithCompleteSentence(trimmed) && len >= sentenceLength) {
    return { shouldSend: true, reason: 'sentence_end' };
  }

  if (endsWithPause(trimmed) && len >= pauseLength) {
    return { shouldSend: true, reason: 'pause_end' };
  }

  return { shouldSend: false, reason: 'waiting' };
}

function extractSegment(buffer: string): [string, string] {
  const trimmed = buffer.trim();
  
  // 优先按段落分割
  const paragraphMatch = trimmed.match(/(.*?[。！？.!?…]+\s*\n)/s);
  if (paragraphMatch) {
    return [paragraphMatch[1].trim(), trimmed.slice(paragraphMatch[1].length)];
  }

  // 按完整句子分割
  const sentenceMatch = trimmed.match(/(.*?[。！？.!?…]+)/);
  if (sentenceMatch) {
    return [sentenceMatch[1].trim(), trimmed.slice(sentenceMatch[1].length)];
  }

  // 按逗号分割（较长时）
  if (trimmed.length >= 50) {
    const pauseMatch = trimmed.match(/(.*?[，、；,;]+)/);
    if (pauseMatch) {
      return [pauseMatch[1].trim(), trimmed.slice(pauseMatch[1].length)];
    }
  }

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

    const cached = audioUrlCacheRef.current.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.url;
    }

    const inFlight = inFlightRef.current.get(key);
    if (inFlight) {
      return await inFlight;
    }

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
  // ✅ 新增：流式追加接口（智能分段）
  // ========================================
  const appendStream = useCallback((chunk: string, opts?: {
    minLength?: number;
    sentenceLength?: number;
    maxLength?: number;
    pauseLength?: number;
    debounceMs?: number;
  }) => {
    const {
      minLength = 20,
      sentenceLength = 30,
      maxLength = 150,
      pauseLength = 60,
      debounceMs = 500,
    } = opts || {};

    streamBufferRef.current.buffer += chunk;

    const decision = shouldSendTTSSegment(streamBufferRef.current.buffer, {
      minLength,
      sentenceLength,
      maxLength,
      pauseLength,
    });

    if (decision.shouldSend) {
      const [toSend, remaining] = extractSegment(streamBufferRef.current.buffer);
      streamBufferRef.current.buffer = remaining;

      if (streamBufferRef.current.timer) {
        window.clearTimeout(streamBufferRef.current.timer);
        streamBufferRef.current.timer = null;
      }

      if (toSend) {
        console.log(`[TTS Stream] ${decision.reason}: "${toSend.substring(0, 50)}${toSend.length > 50 ? '...' : ''}"`);
        enqueue(toSend);
      }
    } else {
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
  // ✅ 新增：刷新缓冲区（流式结束时调用）
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