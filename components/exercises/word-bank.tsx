"use client";

import { useState, useEffect, useCallback } from "react";
import type { WordBankExercise } from "@/lib/content/types";
import { useExercise } from "@/hooks/use-exercise";
import { useAudio } from "@/hooks/use-audio";
import { ExerciseShell } from "./exercise-shell";
import { HoverableText } from "@/components/word/hoverable-text";
import { AudioSpinner } from "@/components/audio-spinner";
import { ReplayButton } from "@/components/replay-button";

interface Props {
  exercise: WordBankExercise;
  onResult: (correct: boolean, answer: string) => void;
  onContinue: () => void;
  language: string;
  autoplayAudio?: boolean;
}

function shuffleArr<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function WordBank({ exercise, onResult, onContinue, language, autoplayAudio = true }: Props) {
  // selected stores { word, bankIndex } so we can return words to exact slots
  const [selected, setSelected] = useState<{ word: string; bankIndex: number }[]>([]);
  const [bank] = useState<string[]>(() =>
    exercise.randomOrder ? shuffleArr(exercise.words) : [...exercise.words]
  );
  const [taken, setTaken] = useState<Set<number>>(new Set());
  const { status, checkAnswer } = useExercise();
  const { play, stop, loading: audioLoading } = useAudio();

  useEffect(() => {
    if (autoplayAudio && !exercise.noAudio?.includes("text")) play(exercise.text, language);
    return stop;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function addWord(word: string, bankIndex: number) {
    setSelected((prev) => [...prev, { word, bankIndex }]);
    setTaken((prev) => new Set(prev).add(bankIndex));
  }

  function removeLastWord() {
    if (selected.length === 0) return;
    const last = selected[selected.length - 1];
    setSelected((prev) => prev.slice(0, -1));
    setTaken((prev) => {
      const next = new Set(prev);
      next.delete(last.bankIndex);
      return next;
    });
  }

  function removeWord(index: number) {
    const item = selected[index];
    setSelected((prev) => prev.filter((_, i) => i !== index));
    setTaken((prev) => {
      const next = new Set(prev);
      next.delete(item.bankIndex);
      return next;
    });
  }

  function handleCheck() {
    const words = selected.map((s) => s.word);
    const correct =
      words.length === exercise.answer.length &&
      words.every((w, i) => w === exercise.answer[i]);
    checkAnswer(correct);
    onResult(correct, words.join(" "));
  }

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (status !== "answering") return;
      if (e.key === "Backspace") {
        e.preventDefault();
        removeLastWord();
        return;
      }
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= bank.length && !taken.has(num - 1)) {
        addWord(bank[num - 1], num - 1);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, bank, taken]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <ExerciseShell
      status={status}
      onCheck={handleCheck}
      onContinue={onContinue}
      canCheck={selected.length > 0}
      correctAnswer={exercise.answer.join(" ")}
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

      {/* Answer area */}
      <div className="min-h-[60px] rounded-xl border-2 border-lingo-border bg-white p-3 mb-6 flex flex-wrap gap-2">
        {selected.length === 0 && (
          <span className="text-lingo-gray-dark">Tap words to build your answer</span>
        )}
        {selected.map((item, i) => (
          <button
            key={`${item.word}-${item.bankIndex}`}
            disabled={status !== "answering"}
            onClick={() => removeWord(i)}
            className="rounded-xl border-2 border-lingo-blue bg-blue-50 px-4 py-2 font-bold text-lingo-blue transition-all hover:bg-blue-100"
          >
            {item.word}
          </button>
        ))}
      </div>

      {/* Word bank */}
      <div className="flex flex-wrap gap-2 justify-center">
        {bank.map((word, i) => (
          <button
            key={`${word}-${i}`}
            disabled={taken.has(i) || status !== "answering"}
            onClick={() => addWord(word, i)}
            className={`rounded-xl border-2 px-4 py-2 font-bold transition-all ${
              taken.has(i)
                ? "border-transparent bg-transparent text-transparent pointer-events-none"
                : "border-lingo-border bg-white text-lingo-text hover:bg-lingo-gray/30 hover:border-lingo-gray-dark"
            }`}
          >
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-current text-xs">
              {i + 1}
            </span>
            {word}
          </button>
        ))}
      </div>
    </ExerciseShell>
  );
}
