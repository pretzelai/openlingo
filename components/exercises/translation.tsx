"use client";

import { useState } from "react";
import type { TranslationExercise } from "@/lib/content/types";
import { useExercise } from "@/hooks/use-exercise";
import { ExerciseShell } from "./exercise-shell";

interface Props {
  exercise: TranslationExercise;
  onResult: (correct: boolean, answer: string) => void;
  onContinue: () => void;
}

export function Translation({ exercise, onResult, onContinue }: Props) {
  const [input, setInput] = useState("");
  const { status, checkAnswer } = useExercise();

  function handleCheck() {
    const trimmed = input.trim();
    const allAccepted = [exercise.answer, ...exercise.acceptAlso].map((a) =>
      a.toLowerCase()
    );
    const correct = allAccepted.includes(trimmed.toLowerCase());
    checkAnswer(correct);
    onResult(correct, trimmed);
  }

  return (
    <ExerciseShell
      status={status}
      onCheck={handleCheck}
      onContinue={onContinue}
      canCheck={input.trim().length > 0}
      correctAnswer={exercise.answer}
    >
      <h2 className="text-xl font-bold text-lingo-text mb-2">
        {exercise.prompt}
      </h2>
      <p className="text-lg text-lingo-text-light mb-6">
        &ldquo;{exercise.sentence}&rdquo;
      </p>
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && input.trim() && status === "answering") handleCheck();
        }}
        disabled={status !== "answering"}
        placeholder="Type your answer..."
        className="w-full rounded-xl border-2 border-lingo-border bg-white px-4 py-3 text-lg focus:border-lingo-blue focus:outline-none"
        autoFocus
      />
    </ExerciseShell>
  );
}
