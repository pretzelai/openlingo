"use client";

import { useState, useEffect } from "react";
import type { MatchingPairsExercise } from "@/lib/content/types";
import { useExercise } from "@/hooks/use-exercise";
import { ExerciseShell } from "./exercise-shell";

interface Props {
  exercise: MatchingPairsExercise;
  onResult: (correct: boolean, answer: string) => void;
  onContinue: () => void;
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function MatchingPairs({ exercise, onResult, onContinue }: Props) {
  const { status, checkAnswer } = useExercise();
  const [leftItems] = useState(() => shuffle(exercise.pairs.map((p) => p.left)));
  const [rightItems] = useState(() => shuffle(exercise.pairs.map((p) => p.right)));
  const [selectedLeft, setSelectedLeft] = useState<string | null>(null);
  const [selectedRight, setSelectedRight] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<{ left: string; right: string } | null>(null);

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

  function handleCheck() {
    checkAnswer(true);
    onResult(true, "all matched");
  }

  return (
    <ExerciseShell
      status={status}
      onCheck={handleCheck}
      onContinue={onContinue}
      canCheck={allMatched}
    >
      <h2 className="text-xl font-bold text-lingo-text mb-6">
        Tap the matching pairs
      </h2>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          {leftItems.map((item) => (
            <button
              key={item}
              disabled={matched.has(item) || status !== "answering"}
              onClick={() => setSelectedLeft(item)}
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
              {item}
            </button>
          ))}
        </div>
        <div className="space-y-2">
          {rightItems.map((item) => (
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
              {item}
            </button>
          ))}
        </div>
      </div>
    </ExerciseShell>
  );
}
