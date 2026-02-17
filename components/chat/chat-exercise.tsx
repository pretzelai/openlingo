"use client";

import { useState, useCallback, useRef } from "react";
import type { Exercise } from "@/lib/content/types";
import { MultipleChoice } from "@/components/exercises/multiple-choice";
import { Translation } from "@/components/exercises/translation";
import { FillInTheBlank } from "@/components/exercises/fill-in-the-blank";
import { MatchingPairs } from "@/components/exercises/matching-pairs";
import { Listening } from "@/components/exercises/listening";
import { WordBank } from "@/components/exercises/word-bank";
import { FlashcardReview } from "@/components/exercises/flashcard-review";

interface ChatExerciseProps {
  exercise: Exercise;
  toolCallId: string;
  language: string;
  completed?: { correct: boolean; answer: string };
  onComplete: (
    toolCallId: string,
    correct: boolean,
    userAnswer: string,
    exercise: Exercise,
  ) => void;
  autoplayAudio?: boolean;
}

export function ChatExercise({
  exercise,
  toolCallId,
  language,
  completed,
  onComplete,
  autoplayAudio = true,
}: ChatExerciseProps) {
  const [result, setResult] = useState<{
    correct: boolean;
    answer: string;
  } | null>(null);
  const resultRef = useRef<{ correct: boolean; answer: string } | null>(null);

  const handleResult = useCallback(
    (correct: boolean, answer: string) => {
      const r = { correct, answer };
      resultRef.current = r;
      setResult(r);
    },
    []
  );

  const handleContinue = useCallback(() => {
    const r = resultRef.current;
    if (r) {
      onComplete(toolCallId, r.correct, r.answer, exercise);
    }
  }, [toolCallId, onComplete, exercise]);

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
        autoplayAudio={autoplayAudio}
      />
    </div>
  );
}

function ExerciseRenderer({
  exercise,
  onResult,
  onContinue,
  language,
  autoplayAudio = true,
}: {
  exercise: Exercise;
  onResult: (correct: boolean, answer: string) => void;
  onContinue: () => void;
  language: string;
  autoplayAudio?: boolean;
}) {
  switch (exercise.type) {
    case "multiple-choice":
      return (
        <MultipleChoice
          exercise={exercise}
          onResult={onResult}
          onContinue={onContinue}
          language={language}
          autoplayAudio={autoplayAudio}
        />
      );
    case "translation":
      return (
        <Translation
          exercise={exercise}
          onResult={onResult}
          onContinue={onContinue}
          language={language}
          autoplayAudio={autoplayAudio}
        />
      );
    case "fill-in-the-blank":
      return (
        <FillInTheBlank
          exercise={exercise}
          onResult={onResult}
          onContinue={onContinue}
          language={language}
          autoplayAudio={autoplayAudio}
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
          autoplayAudio={autoplayAudio}
        />
      );
    case "word-bank":
      return (
        <WordBank
          exercise={exercise}
          onResult={onResult}
          onContinue={onContinue}
          language={language}
          autoplayAudio={autoplayAudio}
        />
      );
    case "flashcard-review":
      return (
        <FlashcardReview
          exercise={exercise}
          language={language}
          onResult={onResult}
          onContinue={onContinue}
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
