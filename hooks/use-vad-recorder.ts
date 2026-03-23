"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { analyzeVADSample, getAudioUploadFilename } from "@/lib/audio/voice";

type VADStatus = "idle" | "listening" | "processing";
type StopReason = "manual" | "silence" | "no-speech" | "max-duration" | "cancel";

interface UseVADRecorderOptions {
  language: string;
  silenceMs?: number;
  noSpeechTimeoutMs?: number;
  maxDurationMs?: number;
  onTranscription?: (text: string) => void;
}

function getSupportedMimeType() {
  if (typeof MediaRecorder === "undefined") return null;
  if (MediaRecorder.isTypeSupported("audio/webm;codecs=opus")) {
    return "audio/webm;codecs=opus";
  }
  if (MediaRecorder.isTypeSupported("audio/webm")) {
    return "audio/webm";
  }
  return "";
}

export function useVADRecorder({
  language,
  silenceMs = 2000,
  noSpeechTimeoutMs = 8000,
  maxDurationMs = 30000,
  onTranscription,
}: UseVADRecorderOptions) {
  const [status, setStatus] = useState<VADStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [level, setLevel] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);

  const speechStartedRef = useRef(false);
  const startTimeRef = useRef(0);
  const lastSpeechAtRef = useRef(0);
  const noiseFloorRef = useRef(0);
  const stopReasonRef = useRef<StopReason>("manual");
  const levelUpdatedAtRef = useRef(0);
  const onTranscriptionRef = useRef(onTranscription);
  const cycleIdRef = useRef(0);
  onTranscriptionRef.current = onTranscription;

  const isSupported =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== "undefined";

  const cleanupRealtimeResources = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }

    analyserRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      streamRef.current = null;
    }
  }, []);

  const transcribe = useCallback(
    async (blob: Blob) => {
      const formData = new FormData();
      formData.append("audio", blob, getAudioUploadFilename(blob.type));
      formData.append("language", language);

      const res = await fetch("/api/stt", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Transcription failed");
      }

      const data = (await res.json()) as { text?: string };
      return data.text?.trim() ?? "";
    },
    [language],
  );

  const stopWithReason = useCallback(
    (reason: StopReason) => {
      const recorder = mediaRecorderRef.current;
      if (!recorder || recorder.state !== "recording") return;
      stopReasonRef.current = reason;
      recorder.stop();
    },
    [],
  );

  const startMonitoring = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;

    const data = new Uint8Array(analyser.fftSize);

    const tick = () => {
      const currentAnalyser = analyserRef.current;
      const recorder = mediaRecorderRef.current;

      if (!currentAnalyser || !recorder || recorder.state !== "recording") {
        return;
      }

      currentAnalyser.getByteTimeDomainData(data);

      let sum = 0;
      for (let i = 0; i < data.length; i++) {
        const normalized = data[i] / 128 - 1;
        sum += normalized * normalized;
      }
      const rms = Math.sqrt(sum / data.length);

      const now = performance.now();
      const elapsed = now - startTimeRef.current;

      const analysis = analyzeVADSample({
        rms,
        elapsedMs: elapsed,
        noiseFloor: noiseFloorRef.current,
        speechStarted: speechStartedRef.current,
      });

      noiseFloorRef.current = analysis.nextNoiseFloor;

      if (analysis.speechDetected) {
        speechStartedRef.current = true;
        lastSpeechAtRef.current = now;
      }

      if (now - levelUpdatedAtRef.current > 80) {
        levelUpdatedAtRef.current = now;
        setLevel(Math.min(1, rms / (analysis.threshold * 2)));
      }

      if (!speechStartedRef.current && elapsed >= noSpeechTimeoutMs) {
        stopWithReason("no-speech");
        return;
      }

      if (elapsed >= maxDurationMs) {
        stopWithReason("max-duration");
        return;
      }

      if (speechStartedRef.current && now - lastSpeechAtRef.current >= silenceMs) {
        stopWithReason("silence");
        return;
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  }, [maxDurationMs, noSpeechTimeoutMs, silenceMs, stopWithReason]);

  const start = useCallback(async () => {
    if (!isSupported || status === "listening") return;

    setError(null);
    setTranscript(null);
    setLevel(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = getSupportedMimeType();

      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      const AudioContextCtor =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;

      if (!AudioContextCtor) {
        throw new Error("AudioContext is not supported in this browser.");
      }

      const audioContext = new AudioContextCtor();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 2048;
      analyser.smoothingTimeConstant = 0.2;
      source.connect(analyser);

      streamRef.current = stream;
      mediaRecorderRef.current = recorder;
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const cycleId = cycleIdRef.current + 1;
      cycleIdRef.current = cycleId;

      chunksRef.current = [];
      speechStartedRef.current = false;
      noiseFloorRef.current = 0;
      stopReasonRef.current = "manual";
      startTimeRef.current = performance.now();
      lastSpeechAtRef.current = startTimeRef.current;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setError("Could not record audio. Please try again.");
      };

      recorder.onstop = async () => {
        if (cycleId !== cycleIdRef.current) {
          cleanupRealtimeResources();
          mediaRecorderRef.current = null;
          chunksRef.current = [];
          return;
        }

        const reason = stopReasonRef.current;
        const blob =
          chunksRef.current.length > 0
            ? new Blob(chunksRef.current, {
                type: recorder.mimeType || "audio/webm",
              })
            : null;

        cleanupRealtimeResources();
        mediaRecorderRef.current = null;
        chunksRef.current = [];
        setLevel(0);

        if (reason === "cancel") {
          setStatus("idle");
          return;
        }

        if (reason === "no-speech") {
          setError("No speech detected. Try speaking a bit louder.");
          setStatus("idle");
          return;
        }

        if (!blob || blob.size === 0) {
          setError("No audio captured. Please try again.");
          setStatus("idle");
          return;
        }

        setStatus("processing");

        try {
          const text = await transcribe(blob);
          if (cycleId !== cycleIdRef.current) {
            return;
          }
          if (!text) {
            setError("I could not hear anything clearly. Please try again.");
          } else {
            setTranscript(text);
            onTranscriptionRef.current?.(text);
          }
        } catch {
          setError("Could not transcribe audio. Please try again.");
        } finally {
          setStatus("idle");
        }
      };

      recorder.start(250);
      setStatus("listening");
      startMonitoring();
    } catch {
      cleanupRealtimeResources();
      mediaRecorderRef.current = null;
      chunksRef.current = [];
      setStatus("idle");
      setLevel(0);
      setError("Microphone access denied or unavailable.");
    }
  }, [cleanupRealtimeResources, isSupported, startMonitoring, status, transcribe]);

  const stop = useCallback(() => {
    stopWithReason("manual");
  }, [stopWithReason]);

  const cancel = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      stopWithReason("cancel");
    } else {
      cycleIdRef.current += 1;
      cleanupRealtimeResources();
      mediaRecorderRef.current = null;
      chunksRef.current = [];
      setStatus("idle");
      setLevel(0);
    }
  }, [cleanupRealtimeResources, stopWithReason]);

  const clearTranscript = useCallback(() => {
    setTranscript(null);
  }, []);

  useEffect(() => {
    return () => {
      cycleIdRef.current += 1;
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state === "recording") {
        stopReasonRef.current = "cancel";
        recorder.stop();
      }
      cleanupRealtimeResources();
    };
  }, [cleanupRealtimeResources]);

  return {
    isSupported,
    status,
    error,
    transcript,
    level,
    isRecording: status === "listening",
    isProcessing: status === "processing",
    start,
    stop,
    cancel,
    clearTranscript,
  };
}
