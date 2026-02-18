"use client";

import { useState, useEffect, useCallback } from "react";
import type { MatchingPairsExercise } from "@/lib/content/types";
import { useExercise } from "@/hooks/use-exercise";
import { useAudio } from "@/hooks/use-audio";
import { ExerciseShell } from "./exercise-shell";
import { AudioSpinner } from "@/components/audio-spinner";


interface Props {
  exercise: MatchingPairsExercise;
  onResult: (correct: boolean, answer: string) => void;
  onContinue: () => void;
  language: string;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function MatchingPairs({ exercise, onResult, onContinue, language }: Props) {
  const { status, checkAnswer } = useExercise();
  const { play, prefetch, loading: audioLoading } = useAudio();
  const [leftItems] = useState(() => shuffle(exercise.pairs.map((p) => p.left)));
  const [rightItems] = useState(() => shuffle(exercise.pairs.map((p) => p.right)));
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<{ left: string; right: string } | null>(null);

  useEffect(() => {
    prefetch(leftItems, language);
  }, [prefetch, leftItems, language]);

  useEffect(() => {
    if (selectedLeft && selectedRight) {
      const pair = exercise.pairs.find(
        (p) => p.left === selectedLeft && p.right === selectedRight
      );

      if (pair) {
        setMatched((prev) => new Set([...prev, pair.left, pair.right]));
        setSelectedLeft(null);
        setSelectedRight(null);
      } else {
        setWrong({ left: selectedLeft, right: selectedRight });
        setTimeout(() => {
          setWrong(null);
          setSelectedLeft(null);
          setSelectedRight(null);
        }, 500);
      }
    }
  }, [selectedLeft, selectedRight, exercise.pairs]);

  const allMatched = matched.size === exercise.pairs.length * 2;

  // Auto-complete when all pairs are matched — no "Check" button needed
  useEffect(() => {
    if (allMatched && status === "answering") {
      checkAnswer(true);
      onResult(true, "all matched");
    }
  }, [allMatched, status, checkAnswer, onResult]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (status !== "answering") return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= leftItems.length) {
        const item = leftItems[num - 1];
        if (!matched.has(item)) setSelectedLeft(item);
      } else if (num >= 5 && num <= 4 + rightItems.length) {
        const item = rightItems[num - 5];
        if (!matched.has(item)) setSelectedRight(item);
      }
    },
    [status, leftItems, rightItems, matched]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <ExerciseShell
      status={status}
      onCheck={() => {}}
      onContinue={onContinue}
      canCheck={false}
      language={language}
    >
      <h2 className="text-xl font-bold text-lingo-text mb-6">
        Tap the matching pairs
      </h2>
      <AudioSpinner loading={audioLoading} />
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          {leftItems.map((item, i) => (
            <button
              key={item}
              disabled={matched.has(item) || status !== "answering"}
              onClick={() => { setSelectedLeft(item); play(item, language); }}
              className={`w-full rounded-xl border-2 p-3 text-center font-bold transition-all ${
                matched.has(item)
                  ? "border-lingo-green bg-green-50 text-lingo-green opacity-60"
                  : wrong?.left === item
                    ? "border-lingo-red bg-red-50"
                    : selectedLeft === item
                      ? "border-lingo-blue bg-blue-50 text-lingo-blue"
                      : "border-lingo-border bg-white hover:bg-lingo-gray/20"
              }`}
            >
              <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-current text-xs">
                {i + 1}
              </span>
              {item}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {rightItems.map((item, i) => (
            <button
              key={item}
              disabled={matched.has(item) || status !== "answering"}
              onClick={() => setSelectedRight(item)}
              className={`w-full rounded-xl border-2 p-3 text-center font-bold transition-all ${
                matched.has(item)
                  ? "border-lingo-green bg-green-50 text-lingo-green opacity-60"
                  : wrong?.right === item
                    ? "border-lingo-red bg-red-50"
                    : selectedRight === item
                      ? "border-lingo-blue bg-blue-50 text-lingo-blue"
                      : "border-lingo-border bg-white hover:bg-lingo-gray/20"
              }`}
            >
              <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-current text-xs">
                {i + 5}
              </span>
              {item}
            </button>
          ))}
        </div>
      </div>
    </ExerciseShell>
  );
}
