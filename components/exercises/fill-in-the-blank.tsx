"use client";

import { useState } from "react";
import type { FillInTheBlankExercise } from "@/lib/content/types";
import { useExercise } from "@/hooks/use-exercise";
import { ExerciseShell } from "./exercise-shell";
import { HoverableText } from "@/components/word/hoverable-text";

interface Props {
  exercise: FillInTheBlankExercise;
  onResult: (correct: boolean, answer: string) => void;
  onContinue: () => void;
  language: string;
}

export function FillInTheBlank({ exercise, onResult, onContinue, language }: Props) {
  const [input, setInput] = useState("");
  const { status, checkAnswer } = useExercise();

  function handleCheck() {
    const correct = input.trim().toLowerCase() === exercise.blank.toLowerCase();
    checkAnswer(correct);
    onResult(correct, input.trim());
  }

  const parts = exercise.sentence.split("___");

  return (
    <ExerciseShell
      status={status}
      onCheck={handleCheck}
      onContinue={onContinue}
      canCheck={input.trim().length > 0}
      correctAnswer={exercise.blank}
    >
      <h2 className="text-xl font-bold text-lingo-text mb-6">
        Fill in the blank
      </h2>
      <div className="flex flex-wrap items-center gap-2 text-2xl font-bold text-lingo-text mb-6">
        <HoverableText text={parts[0]} language={language} />
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && input.trim() && status === "answering") handleCheck();
          }}
          disabled={status !== "answering"}
          className="w-40 border-b-4 border-lingo-blue bg-transparent text-center focus:outline-none"
          autoFocus
        />
        <HoverableText text={parts[1]} language={language} />
      </div>
    </ExerciseShell>
  );
}
