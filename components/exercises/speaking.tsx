"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { SpeakingExercise } from "@/lib/content/types";
import { useExercise } from "@/hooks/use-exercise";
import { useAudio } from "@/hooks/use-audio";
import { ExerciseShell } from "./exercise-shell";
import { HoverableText } from "@/components/word/hoverable-text";
import { AudioSpinner } from "@/components/audio-spinner";

interface Props {
  exercise: SpeakingExercise;
  onResult: (correct: boolean, answer: string) => void;
  onContinue: () => void;
  language: string;
}

function normalize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{M}\s'-]/gu, "")
    .split(/\s+/)
    .filter(Boolean);
}

function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
    }
  }
  return dp[m][n];
}

function compareWords(expected: string[], transcribed: string[]): boolean[] {
  return expected.map((word, i) => {
    if (i >= transcribed.length) return false;
    if (word === transcribed[i]) return true;
    return levenshtein(word, transcribed[i]) <= 1;
  });
}

export function Speaking({ exercise, onResult, onContinue, language }: Props) {
  const { status, checkAnswer } = useExercise();
  const { play, stop, loading: audioLoading } = useAudio();
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [transcript, setTranscript] = useState<string | null>(null);
  const [wordResults, setWordResults] = useState<boolean[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const checkAnswerRef = useRef(checkAnswer);
  checkAnswerRef.current = checkAnswer;
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const hasAudio = !exercise.noAudio?.includes("sentence");

  useEffect(() => {
    if (hasAudio) play(exercise.sentence, language);
    return stop;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const startRecording = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setTranscribing(true);

        try {
          const formData = new FormData();
          formData.append("audio", blob);
          formData.append("language", language);
          const res = await fetch("/api/stt", { method: "POST", body: formData });
          if (!res.ok) throw new Error("Transcription failed");
          const data = await res.json();
          const transcribedText = data.text as string;
          setTranscript(transcribedText);

          const expectedWords = normalize(exercise.sentence);
          const transcribedWords = normalize(transcribedText);
          const results = compareWords(expectedWords, transcribedWords);
          setWordResults(results);

          // Auto-check immediately
          const correct = results.every(Boolean);
          checkAnswerRef.current(correct);
          onResultRef.current(correct, transcribedText);
        } catch {
          setError("Could not transcribe audio. Please try again.");
        } finally {
          setTranscribing(false);
        }
      };

      mediaRecorder.start();
      setRecording(true);
    } catch {
      setError("Microphone access denied. Please allow microphone access and try again.");
    }
  }, [language, exercise.sentence]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
      setRecording(false);
    }
  }, []);

  const expectedWords = exercise.sentence.split(/\s+/);

  return (
    <ExerciseShell
      status={status}
      onCheck={() => {}}
      onContinue={onContinue}
      canCheck={false}
      correctAnswer={exercise.sentence}
      language={language}
    >
      <h2 className="text-xl font-bold text-lingo-text mb-6">
        Speak this sentence
      </h2>

      {/* Sentence display */}
      <div className="rounded-xl border-2 border-lingo-border bg-white p-4 mb-6">
        {wordResults ? (
          <p className="text-2xl font-bold text-center flex flex-wrap justify-center gap-1">
            {expectedWords.map((word, i) => (
              <span
                key={i}
                className={wordResults[i] ? "text-lingo-green" : "text-lingo-red"}
              >
                {word}
              </span>
            ))}
          </p>
        ) : (
          <p className="text-2xl font-bold text-center text-lingo-text">
            <HoverableText text={exercise.sentence} language={language} noAudio={!hasAudio} />
          </p>
        )}
      </div>

      <AudioSpinner loading={audioLoading} />

      {/* Play button */}
      {hasAudio && (
        <div className="flex justify-center mb-4">
          <button
            onClick={() => play(exercise.sentence, language)}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-lingo-blue text-white border-b-4 border-lingo-blue-dark hover:bg-lingo-blue/90 active:border-b-0 active:mt-1 transition-all"
          >
            <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
              <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
            </svg>
          </button>
        </div>
      )}

      {/* Record / transcription area */}
      {!transcript && !transcribing && (
        <div className="flex justify-center mb-4">
          <button
            onClick={recording ? stopRecording : startRecording}
            disabled={status !== "answering"}
            className={`flex h-16 w-16 items-center justify-center rounded-full border-b-4 transition-all ${
              recording
                ? "bg-lingo-red text-white border-red-700 animate-pulse"
                : "bg-lingo-green text-white border-lingo-green-dark hover:bg-lingo-green/90 active:border-b-0 active:mt-1"
            }`}
          >
            <svg className="h-8 w-8" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
            </svg>
          </button>
        </div>
      )}

      {recording && (
        <p className="text-center text-sm text-lingo-text-light mb-4">
          Recording... Tap the microphone to stop
        </p>
      )}

      {!recording && !transcript && !transcribing && !error && (
        <p className="text-center text-sm text-lingo-text-light mb-4">
          Tap the microphone and say the sentence
        </p>
      )}

      {transcribing && (
        <div className="flex justify-center mb-4">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-lingo-blue border-t-transparent" />
        </div>
      )}

      {transcript && (
        <div className="text-center mb-4">
          <p className="text-sm text-lingo-text-light">You said:</p>
          <p className="text-lg font-medium text-lingo-text">{transcript}</p>
        </div>
      )}

      {error && (
        <p className="text-center text-sm text-lingo-red mb-4">{error}</p>
      )}

    </ExerciseShell>
  );
}
