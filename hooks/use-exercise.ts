"use client";

import { useState, useCallback } from "react";

export type ExerciseStatus = "answering" | "correct" | "incorrect";

interface UseExerciseReturn {
  status: ExerciseStatus;
  checkAnswer: (isCorrect: boolean) => void;
  reset: () => void;
}

export function useExercise(): UseExerciseReturn {
  const [status, setStatus] = useState<ExerciseStatus>("answering");

  const checkAnswer = useCallback((isCorrect: boolean) => {
    setStatus(isCorrect ? "correct" : "incorrect");
  }, []);

  const reset = useCallback(() => {
    setStatus("answering");
  }, []);

  return { status, checkAnswer, reset };
}
