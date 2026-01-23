
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

  // ✅ 新增：缓存 & 并发去重
  const audioUrlCacheRef = useRef<Map<string, CacheEntry>>(new Map());
  const inFlightRef = useRef<Map<string, Promise<string>>>(new Map());

  // 可配：缓存过期时间与最大条数
  const CACHE_TTL_MS = 60 * 60 * 1000; // 1小时
  const CACHE_MAX = 200;

  const normalizeText = (s: string) => s.replace(/\s+/g, " ").trim();

  const buildCacheKey = (message: string, cfg: RoleTTSConfig) => {
    const text = normalizeText(message);
    // 把 undefined 统一成空字符串，保证 key 稳定
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

    // 1) 清过期
    for (const [k, v] of cache.entries()) {
      if (v.expiresAt <= now) cache.delete(k);
    }

    // 2) 控容量：简单策略（超限就删最早插入的一些）
    // Map 保持插入顺序：先删头部
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

    // abort in-flight requests
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

    // ✅ 注意：通常 stop 不需要清缓存（否则去重失效）
    // 如果你希望 stop 后不复用，可在这里清 audioUrlCacheRef.current.clear()
  }, []);

  // ✅ 核心：获取（或生成）音频 URL（带缓存 + 并发去重）
  const getOrCreateAudioUrl = useCallback(async (message: string, cfg: RoleTTSConfig, signal: AbortSignal) => {
    pruneCache();

    const key = buildCacheKey(message, cfg);
    const now = Date.now();

    // 1) 命中缓存
    const cached = audioUrlCacheRef.current.get(key);
    if (cached && cached.expiresAt > now) {
      return cached.url;
    }

    // 2) 并发去重：如果已经有同 key 的请求在跑，直接 await
    const inFlight = inFlightRef.current.get(key);
    if (inFlight) {
      return await inFlight;
    }

    // 3) 发起真正请求，并把 Promise 放进 inFlight
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

      // 你当前后端是返回 fileName → 再拼音频 URL
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
      // 不管成功失败，都要移除 inFlight，避免卡死
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

      // stop 后返回：丢弃
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

  useEffect(() => {
    return () => stop();
  }, [stop]);

  return { enqueue, stop } as const;
}
