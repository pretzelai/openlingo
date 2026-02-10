"use client";

import { useState } from "react";
import type { WordBankExercise } from "@/lib/content/types";
import { useExercise } from "@/hooks/use-exercise";
import { ExerciseShell } from "./exercise-shell";

interface Props {
  exercise: WordBankExercise;
  onResult: (correct: boolean, answer: string) => void;
  onContinue: () => void;
}

export function WordBank({ exercise, onResult, onContinue }: Props) {
  const [selected, setSelected] = useState<string[]>([]);
  const [available, setAvailable] = useState<string[]>(() => [...exercise.words]);
  const { status, checkAnswer } = useExercise();

  function addWord(word: string, index: number) {
    setSelected((prev) => [...prev, word]);
    setAvailable((prev) => prev.filter((_, i) => i !== index));
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

  return (
    <ExerciseShell
      status={status}
      onCheck={handleCheck}
      onContinue={onContinue}
      canCheck={selected.length > 0}
      correctAnswer={exercise.answer.join(" ")}
    >
      <h2 className="text-xl font-bold text-lingo-text mb-6">
        {exercise.prompt}
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
            {word}
          </button>
        ))}
      </div>
    </ExerciseShell>
  );
}
