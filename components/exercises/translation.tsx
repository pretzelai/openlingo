"use client";

import { useState, useEffect } from "react";
import type { TranslationExercise } from "@/lib/content/types";
import { useExercise } from "@/hooks/use-exercise";
import { useAudio } from "@/hooks/use-audio";
import { checkBestMatch } from "@/lib/similarity";
import { ExerciseShell } from "./exercise-shell";
import { HoverableText } from "@/components/word/hoverable-text";
import { AudioSpinner } from "@/components/audio-spinner";

interface Props {
  exercise: TranslationExercise;
  onResult: (correct: boolean, answer: string) => void;
  onContinue: () => void;
  language: string;
  autoplayAudio?: boolean;
}

export function Translation({ exercise, onResult, onContinue, language, autoplayAudio = true }: Props) {
  const [input, setInput] = useState("");
  const [correctedMarkdown, setCorrectedMarkdown] = useState<string>();
  const { status, checkAnswer } = useExercise();
  const { play, stop, loading: audioLoading } = useAudio();

  useEffect(() => {
    if (autoplayAudio && !exercise.noAudio?.includes("sentence")) play(exercise.sentence, language);
    return stop;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function handleCheck() {
    const trimmed = input.trim();
    const result = checkBestMatch(trimmed, [exercise.answer, ...exercise.acceptAlso]);
    if (!result.isCorrect) setCorrectedMarkdown(result.correctedMarkdown);
    checkAnswer(result.isCorrect);
    onResult(result.isCorrect, trimmed);
  }

  return (
    <ExerciseShell
      status={status}
      onCheck={handleCheck}
      onContinue={onContinue}
      canCheck={input.trim().length > 0}
      correctAnswer={exercise.answer}
      correctedMarkdown={correctedMarkdown}
      language={language}
    >
      <h2 className="text-xl font-bold text-lingo-text mb-2">
        <HoverableText text={exercise.text} language={language} noAudio={exercise.noAudio?.includes("text")} />
      </h2>
      <AudioSpinner loading={audioLoading} />
      <p className="text-lg text-lingo-text-light mb-6">
        &ldquo;<HoverableText text={exercise.sentence} language={language} noAudio={exercise.noAudio?.includes("sentence")} />&rdquo;
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
