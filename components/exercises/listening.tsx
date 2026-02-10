"use client";

import { useState } from "react";
import type { ListeningExercise } from "@/lib/content/types";
import { useExercise } from "@/hooks/use-exercise";
import { ExerciseShell } from "./exercise-shell";

interface Props {
  exercise: ListeningExercise;
  onResult: (correct: boolean, answer: string) => void;
  onContinue: () => void;
}

export function Listening({ exercise, onResult, onContinue }: Props) {
  const [input, setInput] = useState("");
  const [played, setPlayed] = useState(false);
  const { status, checkAnswer } = useExercise();

  function speak() {
    if (typeof window === "undefined") return;
    const utterance = new SpeechSynthesisUtterance(exercise.text);
    utterance.lang = exercise.ttsLang;
    utterance.rate = 0.8;
    speechSynthesis.speak(utterance);
    setPlayed(true);
  }

  function handleCheck() {
    const correct =
      input.trim().toLowerCase() === exercise.text.toLowerCase();
    checkAnswer(correct);
    onResult(correct, input.trim());
  }

  return (
    <ExerciseShell
      status={status}
      onCheck={handleCheck}
      onContinue={onContinue}
      canCheck={input.trim().length > 0}
      correctAnswer={exercise.text}
    >
      <h2 className="text-xl font-bold text-lingo-text mb-6">
        Type what you hear
      </h2>
      <div className="flex justify-center mb-6">
        <button
          onClick={speak}
          className="flex h-24 w-24 items-center justify-center rounded-full bg-lingo-blue text-white border-b-4 border-lingo-blue-dark hover:bg-lingo-blue/90 active:border-b-0 active:mt-1 transition-all"
        >
          <svg className="h-10 w-10" fill="currentColor" viewBox="0 0 24 24">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
          </svg>
        </button>
      </div>
      {!played && (
        <p className="text-center text-sm text-lingo-text-light mb-4">
          Tap the speaker to hear the phrase
        </p>
      )}
      <input
        type="text"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && input.trim() && status === "answering") handleCheck();
        }}
        disabled={status !== "answering"}
        placeholder="Type what you hear..."
        className="w-full rounded-xl border-2 border-lingo-border bg-white px-4 py-3 text-lg focus:border-lingo-blue focus:outline-none"
      />
    </ExerciseShell>
  );
}
