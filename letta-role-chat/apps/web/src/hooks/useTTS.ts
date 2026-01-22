import { useRef, useEffect } from 'react';
import { api } from '../services/api';

export type RoleTTSConfig = {
  voice?: string;
  speed?: number;
  pitch?: string;
  style?: string;
};

export default function useTTS(roleConfig: RoleTTSConfig) {
  const audioQueueRef = useRef<Map<number, HTMLAudioElement>>(new Map());
  const isPlayingRef = useRef(false);
  const ttsSeqRef = useRef(0);
  const nextPlaySeqRef = useRef(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  async function stop() {
    // pause current
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch (e) {}
      audioRef.current = null;
    }

    // clear queued audios
    const map = audioQueueRef.current;
    for (const [, a] of Array.from(map.entries())) {
      try { a.pause(); } catch (e) {}
    }
    map.clear();

    // reset seqs
    ttsSeqRef.current = 0;
    nextPlaySeqRef.current = 1;
    isPlayingRef.current = false;
  }

  function tryPlayNext() {
    if (isPlayingRef.current) return;
    const seq = nextPlaySeqRef.current;
    const audio = audioQueueRef.current.get(seq);
    if (!audio) return; // wait for expected seq

    audioQueueRef.current.delete(seq);
    isPlayingRef.current = true;
    audioRef.current = audio;

    audio.play().catch((e) => {
      console.error('Audio play error:', e);
      isPlayingRef.current = false;
      nextPlaySeqRef.current = nextPlaySeqRef.current + 1;
      tryPlayNext();
    });
  }

  async function enqueue(message: string) {
    const seq = ++ttsSeqRef.current;

    try {
      const resp = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          voice: roleConfig.voice,
          speed: roleConfig.speed,
          pitch: roleConfig.pitch,
          style: roleConfig.style,
        }),
      });

      if (!resp.ok) throw new Error('TTS request failed');
      const { fileName } = await resp.json();
      const audioUrl = `/api/tts/audio/${fileName}`;
      const audio = new Audio(audioUrl);

      audio.onended = () => {
        isPlayingRef.current = false;
        nextPlaySeqRef.current = nextPlaySeqRef.current + 1;
        tryPlayNext();
      };

      audioQueueRef.current.set(seq, audio);
      tryPlayNext();
    } catch (error) {
      console.error('TTS enqueue error:', error);
    }
  }

  useEffect(() => {
    return () => {
      // cleanup on unmount
      stop();
    };
  }, []);

  return { enqueue, stop } as const;
}
