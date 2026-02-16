"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { MultipleChoiceExercise } from "@/lib/content/types";
import { useExercise } from "@/hooks/use-exercise";
import { useAudio } from "@/hooks/use-audio";
import { ExerciseShell } from "./exercise-shell";
import { HoverableText } from "@/components/word/hoverable-text";
import { AudioSpinner } from "@/components/audio-spinner";
import { ReplayButton } from "@/components/replay-button";

interface Props {
  exercise: MultipleChoiceExercise;
  onResult: (correct: boolean, answer: string) => void;
  onContinue: () => void;
  language: string;
  autoplayAudio?: boolean;
}

function shuffleWithSeed<T>(arr: T[], seed: number): T[] {
  const result = [...arr];
  let s = seed;
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    const j = s % (i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function MultipleChoice({ exercise, onResult, onContinue, language, autoplayAudio = true }: Props) {
  const [selected, setSelected] = useState<number | null>(null);
  const { status, checkAnswer } = useExercise();
  const { play, stop, loading: audioLoading } = useAudio();

  useEffect(() => {
    if (autoplayAudio && !exercise.noAudio?.includes("text")) play(exercise.text, language);
    return stop;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { choices, correctIndex } = useMemo(() => {
    if (!exercise.randomOrder) {
      return { choices: exercise.choices, correctIndex: exercise.correctIndex };
    }
    const indices = exercise.choices.map((_, i) => i);
    const seed = exercise.text.length * 7 + exercise.text.charCodeAt(0);
    const shuffled = shuffleWithSeed(indices, seed);
    return {
      choices: shuffled.map((i) => exercise.choices[i]),
      correctIndex: shuffled.indexOf(exercise.correctIndex),
    };
  }, [exercise]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (status !== "answering") return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= choices.length) {
        setSelected(num - 1);
      }
    },
    [status, choices.length]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  function handleCheck() {
    if (selected === null) return;
    const correct = selected === correctIndex;
    checkAnswer(correct);
    onResult(correct, choices[selected]);
  }

  return (
    <ExerciseShell
      status={status}
      onCheck={handleCheck}
      onContinue={onContinue}
      canCheck={selected !== null}
      correctAnswer={choices[correctIndex]}
      language={language}
    >
      <div className="flex items-start gap-2 mb-6">
        <h2 className="text-xl font-bold text-lingo-text">
          <HoverableText text={exercise.text} language={language} noAudio={exercise.noAudio?.includes("text")} />
        </h2>
        {!exercise.noAudio?.includes("text") && (
          <ReplayButton onPlay={() => play(exercise.text, language)} />
        )}
      </div>
      <AudioSpinner loading={audioLoading} />
      <div className="space-y-3">
        {choices.map((choice, i) => (
          <button
            key={i}
            disabled={status !== "answering"}
            onClick={() => setSelected(i)}
            className={`w-full rounded-xl border-2 p-4 text-left font-medium transition-all ${
              selected === i
                ? status === "correct" && i === correctIndex
                  ? "border-lingo-green bg-green-50 text-lingo-green"
                  : status === "incorrect" && i === selected
                    ? "border-lingo-red bg-red-50 text-lingo-red"
                    : "border-lingo-blue bg-blue-50 text-lingo-blue"
                : status !== "answering" && i === correctIndex
                  ? "border-lingo-green bg-green-50"
                  : "border-lingo-border bg-white hover:bg-lingo-gray/20"
            }`}
          >
            <span className="mr-3 inline-flex h-7 w-7 items-center justify-center rounded-full border-2 border-current text-sm font-bold">
              {i + 1}
            </span>
            <HoverableText text={choice} language={language} noAudio={exercise.noAudio?.includes(`choice:${i}`)} />
          </button>
        ))}
      </div>
    </ExerciseShell>
  );
}
