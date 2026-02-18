"use client";

import { Button } from "@/components/ui/button";

interface LessonCompleteModalProps {
  perfectScore: boolean;
  onContinue: () => void;
}

export function LessonCompleteModal({
  perfectScore,
  onContinue,
}: LessonCompleteModalProps) {
  return (
    <div className="mx-auto max-w-md py-12 text-center animate-bounce-in">
      <div className="mb-6">
        <span className="text-7xl">{perfectScore ? "🏆" : "🎉"}</span>
      </div>

      <h1 className="text-3xl font-black text-lingo-text mb-2">
        {perfectScore ? "Perfect!" : "Lesson Complete!"}
      </h1>

      {perfectScore && (
        <p className="text-lg text-lingo-yellow font-bold mb-4">
          No mistakes — amazing!
        </p>
      )}

      <div className="mt-8">
        <Button onClick={onContinue} className="w-full max-w-xs mx-auto">
          Continue
        </Button>
      </div>
    </div>
  );
}
