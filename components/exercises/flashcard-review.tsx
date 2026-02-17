"use client";

import { useState } from "react";
import { reviewCard } from "@/lib/actions/srs";
import type { FlashcardReviewExercise } from "@/lib/content/types";
import type { Quality } from "@/lib/srs";

const QUALITY_BUTTONS: { label: string; quality: Quality; color: string }[] = [
  { label: "Again", quality: 0, color: "bg-red-500 hover:bg-red-600" },
  { label: "Hard", quality: 3, color: "bg-orange-500 hover:bg-orange-600" },
  { label: "Good", quality: 4, color: "bg-lingo-blue hover:bg-lingo-blue/90" },
  { label: "Easy", quality: 5, color: "bg-lingo-green hover:bg-lingo-green/90" },
];

export function FlashcardReview({
  exercise,
  language,
  onResult,
  onContinue,
}: {
  exercise: FlashcardReviewExercise;
  language: string;
  onResult: (correct: boolean, answer: string) => void;
  onContinue: () => void;
}) {
  const [revealed, setRevealed] = useState(false);
  const [rated, setRated] = useState(false);

  async function handleRate(quality: Quality) {
    if (rated) return;
    setRated(true);

    // Update SRS directly
    reviewCard(exercise.word, language, quality).catch(() => {});

    const correct = quality >= 3;
    const label = QUALITY_BUTTONS.find((b) => b.quality === quality)!.label;
    onResult(correct, label);
    onContinue();
  }

  return (
    <div>
      {/* Flashcard */}
      <div
        onClick={() => !revealed && setRevealed(true)}
        className={`relative rounded-2xl border-2 border-b-4 p-8 text-center transition-all ${
          !revealed
            ? "border-lingo-border bg-white cursor-pointer hover:bg-lingo-gray/20 active:border-b-2 active:mt-[2px]"
            : "border-lingo-border bg-white"
        }`}
      >
        <p className="text-3xl font-black text-lingo-text mb-2">
          {exercise.word}
        </p>

        {!revealed && (
          <p className="text-sm text-lingo-text-light font-bold">
            Tap to reveal
          </p>
        )}

        {revealed && (
          <div className="mt-4 pt-4 border-t-2 border-lingo-border">
            <p className="text-xl font-bold text-lingo-text-light">
              {exercise.translation}
            </p>
          </div>
        )}
      </div>

      {/* Quality buttons */}
      {revealed && !rated && (
        <div className="grid grid-cols-4 gap-2 mt-4">
          {QUALITY_BUTTONS.map((btn) => (
            <button
              key={btn.quality}
              onClick={() => handleRate(btn.quality)}
              className={`${btn.color} text-white font-bold py-3 px-2 rounded-xl border-b-4 border-black/20 active:border-b-0 active:mt-1 transition-all text-sm`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
