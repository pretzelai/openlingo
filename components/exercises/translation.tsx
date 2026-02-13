"use client";

import { useState, useEffect } from "react";
import type { TranslationExercise } from "@/lib/content/types";
import { useExercise } from "@/hooks/use-exercise";
import { useAudio } from "@/hooks/use-audio";
import { ExerciseShell } from "./exercise-shell";
import { HoverableText } from "@/components/word/hoverable-text";

interface Props {
  exercise: TranslationExercise;
  onResult: (correct: boolean, answer: string) => void;
  onContinue: () => void;
  language: string;
}

export function Translation({ exercise, onResult, onContinue, language }: Props) {
  const [input, setInput] = useState("");
  const { status, checkAnswer } = useExercise();
  const { play, stop } = useAudio();

  useEffect(() => {
    play(exercise.sentence, language);
    return stop;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      language={language}
    >
      <h2 className="text-xl font-bold text-lingo-text mb-2">
        <HoverableText text={exercise.prompt} language={language} />
      </h2>
      <p className="text-lg text-lingo-text-light mb-6">
        &ldquo;<HoverableText text={exercise.sentence} language={language} />&rdquo;
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
