"use client";

import { useRef, useCallback } from "react";

// In-memory URL cache to avoid redundant API calls
const urlCache = new Map<string, string>();

export function useAudio() {
  const currentAudio = useRef<HTMLAudioElement | null>(null);
  const nonceRef = useRef(0);

  const stop = useCallback(() => {
    nonceRef.current++;
    if (currentAudio.current) {
      currentAudio.current.pause();
      currentAudio.current = null;
    }
  }, []);

  const play = useCallback(async (text: string, language: string) => {
    stop();
    const nonce = nonceRef.current;

    const key = `${language}:${text.toLowerCase()}`;
    let url = urlCache.get(key);
    if (!url) {
      const res = await fetch("/api/tts", {
        method: "POST",
        body: JSON.stringify({ text, language }),
      });
      const data = await res.json();
      url = data.url;
      urlCache.set(key, url!);
    }

    // Stale — a newer play() or stop() was called while we were fetching
    if (nonce !== nonceRef.current) return;

    const audio = new Audio(url);
    currentAudio.current = audio;
    audio.play();
  }, [stop]);

  return { play, stop };
}
