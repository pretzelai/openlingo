"use client";

import { useState, useCallback } from "react";
import type { Exercise } from "@/lib/content/types";
import { MultipleChoice } from "@/components/exercises/multiple-choice";
import { Translation } from "@/components/exercises/translation";
import { FillInTheBlank } from "@/components/exercises/fill-in-the-blank";
import { MatchingPairs } from "@/components/exercises/matching-pairs";
import { Listening } from "@/components/exercises/listening";
import { WordBank } from "@/components/exercises/word-bank";

interface ChatExerciseProps {
  exercise: Exercise;
  toolCallId: string;
  language: string;
  completed?: { correct: boolean; answer: string };
  onComplete: (
    toolCallId: string,
    correct: boolean,
    userAnswer: string
  ) => void;
}

export function ChatExercise({
  exercise,
  toolCallId,
  language,
  completed,
  onComplete,
}: ChatExerciseProps) {
  const [result, setResult] = useState<{
    correct: boolean;
    answer: string;
  } | null>(null);

  const handleResult = useCallback(
    (correct: boolean, answer: string) => {
      setResult({ correct, answer });
    },
    []
  );

  const handleContinue = useCallback(() => {
    if (result) {
      onComplete(toolCallId, result.correct, result.answer);
    }
  }, [result, toolCallId, onComplete]);

  // Show completed state
  if (completed) {
    return (
      <div
        className={`rounded-2xl border-2 px-4 py-3 text-sm ${
          completed.correct
            ? "border-lingo-green/30 bg-green-50"
            : "border-lingo-red/30 bg-red-50"
        }`}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">
            {completed.correct ? "\u2713" : "\u2717"}
          </span>
          <span
            className={`font-bold ${completed.correct ? "text-lingo-green" : "text-lingo-red"}`}
          >
            {completed.correct ? "Correct!" : "Incorrect"}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full rounded-2xl border-2 border-lingo-blue/20 bg-white p-4">
      <ExerciseRenderer
        exercise={exercise}
        onResult={handleResult}
        onContinue={handleContinue}
        language={language}
      />
    </div>
  );
}

function ExerciseRenderer({
  exercise,
  onResult,
  onContinue,
  language,
}: {
  exercise: Exercise;
  onResult: (correct: boolean, answer: string) => void;
  onContinue: () => void;
  language: string;
}) {
  switch (exercise.type) {
    case "multiple-choice":
      return (
        <MultipleChoice
          exercise={exercise}
          onResult={onResult}
          onContinue={onContinue}
          language={language}
        />
      );
    case "translation":
      return (
        <Translation
          exercise={exercise}
          onResult={onResult}
          onContinue={onContinue}
          language={language}
        />
      );
    case "fill-in-the-blank":
      return (
        <FillInTheBlank
          exercise={exercise}
          onResult={onResult}
          onContinue={onContinue}
          language={language}
        />
      );
    case "matching-pairs":
      return (
        <MatchingPairs
          exercise={exercise}
          onResult={onResult}
          onContinue={onContinue}
          language={language}
        />
      );
    case "listening":
      return (
        <Listening
          exercise={exercise}
          onResult={onResult}
          onContinue={onContinue}
          language={language}
        />
      );
    case "word-bank":
      return (
        <WordBank
          exercise={exercise}
          onResult={onResult}
          onContinue={onContinue}
          language={language}
        />
      );
    default:
      return (
        <p className="text-sm text-lingo-text-light">
          Unsupported exercise type
        </p>
      );
  }
}
