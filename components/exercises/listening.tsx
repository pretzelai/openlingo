"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import type { ListeningExercise } from "@/lib/content/types";
import { useExercise } from "@/hooks/use-exercise";
import { ExerciseShell } from "./exercise-shell";
import { HoverableText } from "@/components/word/hoverable-text";

interface Props {
  exercise: ListeningExercise;
  onResult: (correct: boolean, answer: string) => void;
  onContinue: () => void;
  language: string;
}

function generateDistractors(text: string): string[] {
  const words = text.split(/\s+/);
  if (words.length <= 2) {
    return [text + "?", text + "!"];
  }
  const d1Words = [...words];
  const mid = Math.floor(d1Words.length / 2);
  [d1Words[mid - 1], d1Words[mid]] = [d1Words[mid], d1Words[mid - 1]];

  const d2Words = [...words];
  [d2Words[0], d2Words[d2Words.length - 1]] = [d2Words[d2Words.length - 1], d2Words[0]];

  return [d1Words.join(" "), d2Words.join(" ")];
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

function SpeakerButton({ onSpeak }: { onSpeak: () => void }) {
  return (
    <div className="flex justify-center mb-6">
      <button
        onClick={onSpeak}
        className="flex h-24 w-24 items-center justify-center rounded-full bg-lingo-blue text-white border-b-4 border-lingo-blue-dark hover:bg-lingo-blue/90 active:border-b-0 active:mt-1 transition-all"
      >
        <svg className="h-10 w-10" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
        </svg>
      </button>
    </div>
  );
}

export function Listening({ exercise, onResult, onContinue, language }: Props) {
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

  if (exercise.mode === "word-bank") {
    return (
      <ListeningWordBank
        exercise={exercise}
        status={status}
        checkAnswer={checkAnswer}
        played={played}
        onSpeak={speak}
        onResult={onResult}
        onContinue={onContinue}
        language={language}
      />
    );
  }

  return (
    <ListeningChoices
      exercise={exercise}
      status={status}
      checkAnswer={checkAnswer}
      played={played}
      onSpeak={speak}
      onResult={onResult}
      onContinue={onContinue}
      language={language}
    />
  );
}

// --- Multiple-choice mode ---

interface ModeProps {
  exercise: ListeningExercise;
  status: "answering" | "correct" | "incorrect";
  checkAnswer: (correct: boolean) => void;
  played: boolean;
  onSpeak: () => void;
  onResult: (correct: boolean, answer: string) => void;
  onContinue: () => void;
  language: string;
}

function ListeningChoices({
  exercise,
  status,
  checkAnswer,
  played,
  onSpeak,
  onResult,
  onContinue,
  language,
}: ModeProps) {
  const [selected, setSelected] = useState<number | null>(null);

  const { choices, correctIndex } = useMemo(() => {
    const distractors = generateDistractors(exercise.text);
    const all = [exercise.text, ...distractors];
    const seed = exercise.text.length * 7 + exercise.text.charCodeAt(0);
    const shuffled = shuffleWithSeed(all, seed);
    return {
      choices: shuffled,
      correctIndex: shuffled.indexOf(exercise.text),
    };
  }, [exercise.text]);

  function handleCheck() {
    if (selected === null) return;
    const correct = selected === correctIndex;
    checkAnswer(correct);
    onResult(correct, choices[selected]);
  }

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

  return (
    <ExerciseShell
      status={status}
      onCheck={handleCheck}
      onContinue={onContinue}
      canCheck={selected !== null}
      correctAnswer={exercise.text}
      language={language}
    >
      <h2 className="text-xl font-bold text-lingo-text mb-6">
        What do you hear?
      </h2>
      <SpeakerButton onSpeak={onSpeak} />
      {!played && (
        <p className="text-center text-sm text-lingo-text-light mb-4">
          Tap the speaker to hear the phrase
        </p>
      )}
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
            <HoverableText text={choice} language={language} />
          </button>
        ))}
      </div>
    </ExerciseShell>
  );
}

// --- Word-bank mode ---

function ListeningWordBank({
  exercise,
  status,
  checkAnswer,
  played,
  onSpeak,
  onResult,
  onContinue,
  language,
}: ModeProps) {
  const answerWords = useMemo(() => exercise.text.split(/\s+/), [exercise.text]);
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [available, setAvailable] = useState<string[]>(() => {
    const words = exercise.text.split(/\s+/);
    // Shuffle using a seeded shuffle
    const seed = exercise.text.length * 13 + exercise.text.charCodeAt(0);
    return shuffleWithSeed(words, seed);
  });

  function addWord(word: string, index: number) {
    setSelectedWords((prev) => [...prev, word]);
    setAvailable((prev) => prev.filter((_, i) => i !== index));
  }

  function removeLastWord() {
    if (selectedWords.length === 0) return;
    const word = selectedWords[selectedWords.length - 1];
    setSelectedWords((prev) => prev.slice(0, -1));
    setAvailable((prev) => [...prev, word]);
  }

  function removeWord(word: string, index: number) {
    setAvailable((prev) => [...prev, word]);
    setSelectedWords((prev) => prev.filter((_, i) => i !== index));
  }

  function handleCheck() {
    const correct =
      selectedWords.length === answerWords.length &&
      selectedWords.every((w, i) => w === answerWords[i]);
    checkAnswer(correct);
    onResult(correct, selectedWords.join(" "));
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
      if (num >= 1 && num <= available.length) {
        addWord(available[num - 1], num - 1);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, available]
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
      canCheck={selectedWords.length > 0}
      correctAnswer={exercise.text}
      language={language}
    >
      <h2 className="text-xl font-bold text-lingo-text mb-6">
        What do you hear?
      </h2>
      <SpeakerButton onSpeak={onSpeak} />
      {!played && (
        <p className="text-center text-sm text-lingo-text-light mb-4">
          Tap the speaker to hear the phrase
        </p>
      )}

      {/* Answer area */}
      <div className="min-h-[60px] rounded-xl border-2 border-lingo-border bg-white p-3 mb-6 flex flex-wrap gap-2">
        {selectedWords.length === 0 && (
          <span className="text-lingo-gray-dark">Tap words to build your answer</span>
        )}
        {selectedWords.map((word, i) => (
          <button
            key={`${word}-${i}`}
            disabled={status !== "answering"}
            onClick={() => removeWord(word, i)}
            className="rounded-xl border-2 border-lingo-blue bg-blue-50 px-4 py-2 font-bold text-lingo-blue transition-all hover:bg-blue-100"
          >
            {word}
          </button>
        ))}
      </div>

      {/* Word bank */}
      <div className="flex flex-wrap gap-2 justify-center">
        {available.map((word, i) => (
          <button
            key={`${word}-${i}`}
            disabled={status !== "answering"}
            onClick={() => addWord(word, i)}
            className="rounded-xl border-2 border-lingo-border bg-white px-4 py-2 font-bold text-lingo-text transition-all hover:bg-lingo-gray/30 hover:border-lingo-gray-dark"
          >
            <span className="mr-2 inline-flex h-5 w-5 items-center justify-center rounded-full border border-current text-xs">
              {i + 1}
            </span>
            <HoverableText text={word} language={language} />
          </button>
        ))}
      </div>
    </ExerciseShell>
  );
}
