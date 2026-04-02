"use client";

import { useRef, useCallback, useState } from "react";

// In-memory URL cache to avoid redundant API calls
const urlCache = new Map<string, string>();

export function useAudio() {
  const currentAudio = useRef<HTMLAudioElement | null>(null);
  const nonceRef = useRef(0);
  const finishPlaybackRef = useRef<(() => void) | null>(null);
  const [loading, setLoading] = useState(false);
  const [playing, setPlaying] = useState(false);

  const clearPlayback = useCallback(() => {
    setPlaying(false);
    currentAudio.current = null;
    finishPlaybackRef.current?.();
    finishPlaybackRef.current = null;
  }, []);

  const stop = useCallback(() => {
    nonceRef.current++;
    setLoading(false);
    if (currentAudio.current) {
      currentAudio.current.pause();
    }
    clearPlayback();
  }, [clearPlayback]);

  const fetchUrl = useCallback(async (text: string, language: string) => {
    const key = `${language}:${text.toLowerCase()}`;
    const cached = urlCache.get(key);
    if (cached) return cached;

    const res = await fetch("/api/tts", {
      method: "POST",
      body: JSON.stringify({ text, language }),
    });
    const data = await res.json();
    urlCache.set(key, data.url!);
    return data.url as string;
  }, []);

  const startPlayback = useCallback(async (text: string, language: string) => {
    stop();
    const nonce = nonceRef.current;

    setLoading(true);
    let url: string;
    try {
      url = await fetchUrl(text, language);
    } finally {
      if (nonce === nonceRef.current) setLoading(false);
    }

    // Stale — a newer play() or stop() was called while we were fetching
    if (nonce !== nonceRef.current) return;

    const audio = new Audio(url);
    currentAudio.current = audio;

    audio.onended = () => {
      if (currentAudio.current === audio) {
        clearPlayback();
      }
    };

    audio.onerror = () => {
      if (currentAudio.current === audio) {
        clearPlayback();
      }
    };

    setPlaying(true);

    try {
      await audio.play();
    } catch {
      if (currentAudio.current === audio) {
        clearPlayback();
      }
      throw new Error("Audio playback failed");
    }

    return audio;
  }, [clearPlayback, fetchUrl, stop]);

  const play = useCallback(async (text: string, language: string) => {
    await startPlayback(text, language);
  }, [startPlayback]);

  const playAndWait = useCallback(async (text: string, language: string) => {
    const audio = await startPlayback(text, language);
    if (!audio) return;

    await new Promise<void>((resolve) => {
      finishPlaybackRef.current = () => {
        if (finishPlaybackRef.current) {
          finishPlaybackRef.current = null;
        }
        resolve();
      };
    });
  }, [startPlayback]);

  const prefetch = useCallback((texts: string[], language: string) => {
    texts.forEach((text) => fetchUrl(text, language));
  }, [fetchUrl]);

  return { play, playAndWait, stop, prefetch, loading, playing };
}
