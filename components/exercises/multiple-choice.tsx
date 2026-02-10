"use client";

import { useState } from "react";
import type { MultipleChoiceExercise } from "@/lib/content/types";
import { useExercise } from "@/hooks/use-exercise";
import { ExerciseShell } from "./exercise-shell";

interface Props {
  exercise: MultipleChoiceExercise;
  onResult: (correct: boolean, answer: string) => void;
  onContinue: () => void;
}

export function MultipleChoice({ exercise, onResult, onContinue }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const { status, checkAnswer } = useExercise();

  function handleCheck() {
    if (selected === null) return;
    const correct = selected === exercise.correctIndex;
    checkAnswer(correct);
    onResult(correct, exercise.choices[selected]);
  }

  return (
    <ExerciseShell
      status={status}
      onCheck={handleCheck}
      onContinue={onContinue}
      canCheck={selected !== null}
      correctAnswer={exercise.choices[exercise.correctIndex]}
    >
      <h2 className="text-xl font-bold text-lingo-text mb-6">
        {exercise.prompt}
      </h2>
      <div className="space-y-3">
        {exercise.choices.map((choice, i) => (
          <button
            key={i}
            disabled={status !== "answering"}
            onClick={() => setSelected(i)}
            className={`w-full rounded-xl border-2 p-4 text-left font-medium transition-all ${
              selected === i
                ? status === "correct" && i === exercise.correctIndex
                  ? "border-lingo-green bg-green-50 text-lingo-green"
                  : status === "incorrect" && i === selected
                    ? "border-lingo-red bg-red-50 text-lingo-red"
                    : "border-lingo-blue bg-blue-50 text-lingo-blue"
                : status !== "answering" && i === exercise.correctIndex
                  ? "border-lingo-green bg-green-50"
                  : "border-lingo-border bg-white hover:bg-lingo-gray/20"
            }`}
          >
            <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-current text-sm font-bold">
              {i + 1}
            </span>
            {choice}
          </button>
        ))}
      </div>
    </ExerciseShell>
  );
}
