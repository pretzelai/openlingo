"use client";

import { useState, useCallback } from "react";
import type { Exercise } from "@/lib/content/types";

interface ExerciseResult {
  exerciseIndex: number;
  exerciseType: string;
  correct: boolean;
  userAnswer: string;
}

interface UseLessonReturn {
  currentIndex: number;
  totalExercises: number;
  currentExercise: Exercise;
  results: ExerciseResult[];
  isComplete: boolean;
  mistakeCount: number;
  recordResult: (correct: boolean, userAnswer: string) => void;
  advance: () => void;
}

export function useLesson(exercises: Exercise[]): UseLessonReturn {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [results, setResults] = useState<ExerciseResult[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [mistakeCount, setMistakeCount] = useState(0);

  const currentExercise = exercises[currentIndex];

  const recordResult = useCallback(
    (correct: boolean, userAnswer: string) => {
      setResults((prev) => [
        ...prev,
        {
          exerciseIndex: currentIndex,
          exerciseType: exercises[currentIndex].type,
          correct,
          userAnswer,
        },
      ]);
      if (!correct) setMistakeCount((m) => m + 1);
    },
    [currentIndex, exercises]
  );

  const advance = useCallback(() => {
    if (currentIndex + 1 >= exercises.length) {
      setIsComplete(true);
    } else {
      setCurrentIndex((i) => i + 1);
    }
  }, [currentIndex, exercises.length]);

  return {
    currentIndex,
    totalExercises: exercises.length,
    currentExercise,
    results,
    isComplete,
    mistakeCount,
    recordResult,
    advance,
  };
}
