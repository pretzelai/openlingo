import React from "react";
import type { Exercise } from "@/lib/types";
import { MultipleChoice } from "./multiple-choice";
import { Translation } from "./translation";
import { FillInTheBlank } from "./fill-in-the-blank";
import { MatchingPairs } from "./matching-pairs";
import { Listening } from "./listening";
import { WordBank } from "./word-bank";
import { Speaking } from "./speaking";
import { FreeText } from "./free-text";
import { FlashcardReview } from "./flashcard-review";

interface Props {
  exercise: Exercise;
  onResult: (correct: boolean, answer: string) => void;
  onContinue: () => void;
}

export function ExerciseRenderer({ exercise, onResult, onContinue }: Props) {
  switch (exercise.type) {
    case "multiple-choice":
      return (
        <MultipleChoice
          exercise={exercise}
          onResult={onResult}
          onContinue={onContinue}
        />
      );
    case "translation":
      return (
        <Translation
          exercise={exercise}
          onResult={onResult}
          onContinue={onContinue}
        />
      );
    case "fill-in-the-blank":
      return (
        <FillInTheBlank
          exercise={exercise}
          onResult={onResult}
          onContinue={onContinue}
        />
      );
    case "matching-pairs":
      return (
        <MatchingPairs
          exercise={exercise}
          onResult={onResult}
          onContinue={onContinue}
        />
      );
    case "listening":
      return (
        <Listening
          exercise={exercise}
          onResult={onResult}
          onContinue={onContinue}
        />
      );
    case "word-bank":
      return (
        <WordBank
          exercise={exercise}
          onResult={onResult}
          onContinue={onContinue}
        />
      );
    case "speaking":
      return (
        <Speaking
          exercise={exercise}
          onResult={onResult}
          onContinue={onContinue}
        />
      );
    case "free-text":
      return (
        <FreeText
          exercise={exercise}
          onResult={onResult}
          onContinue={onContinue}
        />
      );
    case "flashcard-review":
      return (
        <FlashcardReview
          exercise={exercise}
          onResult={onResult}
          onContinue={onContinue}
        />
      );
    default:
      return null;
  }
}
