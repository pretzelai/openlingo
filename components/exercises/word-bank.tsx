"use client";

import { useState, useEffect, useCallback } from "react";
import type { WordBankExercise } from "@/lib/content/types";
import { useExercise } from "@/hooks/use-exercise";
import { ExerciseShell } from "./exercise-shell";
import { HoverableText } from "@/components/word/hoverable-text";

interface Props {
  exercise: WordBankExercise;
  onResult: (correct: boolean, answer: string) => void;
  onContinue: () => void;
  language: string;
}

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function WordBank({ exercise, onResult, onContinue, language }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [available, setAvailable] = useState<string[]>(() =>
    exercise.randomOrder ? shuffleArr(exercise.words) : [...exercise.words]
  );
  const { status, checkAnswer } = useExercise();

  function addWord(word: string, index: number) {
    setSelected((prev) => [...prev, word]);
    setAvailable((prev) => prev.filter((_, i) => i !== index));
  }

  function removeLastWord() {
    if (selected.length === 0) return;
    const word = selected[selected.length - 1];
    setSelected((prev) => prev.slice(0, -1));
    setAvailable((prev) => [...prev, word]);
  }

  function removeWord(word: string, index: number) {
    setAvailable((prev) => [...prev, word]);
    setSelected((prev) => prev.filter((_, i) => i !== index));
  }

  function handleCheck() {
    const correct =
      selected.length === exercise.answer.length &&
      selected.every((w, i) => w === exercise.answer[i]);
    checkAnswer(correct);
    onResult(correct, selected.join(" "));
  }

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (status !== "answering") return;
      if (e.key === "Backspace") {
        e.preventDefault();
        removeLastWord();
        return;
      }
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= available.length) {
        addWord(available[num - 1], num - 1);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, available]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <ExerciseShell
      status={status}
      onCheck={handleCheck}
      onContinue={onContinue}
      canCheck={selected.length > 0}
      correctAnswer={exercise.answer.join(" ")}
    >
      <h2 className="text-xl font-bold text-lingo-text mb-6">
        <HoverableText text={exercise.prompt} language={language} />
      </h2>

      {/* Answer area */}
      <div className="min-h-[60px] rounded-xl border-2 border-lingo-border bg-white p-3 mb-6 flex flex-wrap gap-2">
        {selected.length === 0 && (
          <span className="text-lingo-gray-dark">Tap words to build your answer</span>
        )}
        {selected.map((word, i) => (
          <button
            key={`${word}-${i}`}
            disabled={status !== "answering"}
            onClick={() => removeWord(word, i)}
            className="rounded-xl border-2 border-lingo-blue bg-blue-50 px-4 py-2 font-bold text-lingo-blue transition-all hover:bg-blue-100"
          >
            {word}
          </button>
        ))}
      </div>

      {/* Word bank */}
      <div className="flex flex-wrap gap-2 justify-center">
        {available.map((word, i) => (
          <button
            key={`${word}-${i}`}
            disabled={status !== "answering"}
            onClick={() => addWord(word, i)}
            className="rounded-xl border-2 border-lingo-border bg-white px-4 py-2 font-bold text-lingo-text transition-all hover:bg-lingo-gray/30 hover:border-lingo-gray-dark"
          >
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-current text-xs">
              {i + 1}
            </span>
            {word}
          </button>
        ))}
      </div>
    </ExerciseShell>
  );
}
