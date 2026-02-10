"use client";

import { Button } from "@/components/ui/button";

interface LessonCompleteModalProps {
  xpEarned: number;
  perfectScore: boolean;
  heartsLost: number;
  onContinue: () => void;
}

export function LessonCompleteModal({
  xpEarned,
  perfectScore,
  heartsLost,
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

      <div className="flex justify-center gap-8 my-8">
        <div className="text-center">
          <div className="text-4xl font-black text-lingo-yellow animate-xp-count">
            +{xpEarned}
          </div>
          <div className="text-sm font-bold text-lingo-text-light mt-1">
            XP earned
          </div>
        </div>
        {heartsLost > 0 && (
          <div className="text-center">
            <div className="text-4xl font-black text-lingo-red">
              -{heartsLost}
            </div>
            <div className="text-sm font-bold text-lingo-text-light mt-1">
              Hearts lost
            </div>
          </div>
        )}
      </div>

      <Button onClick={onContinue} className="w-full max-w-xs mx-auto">
        Continue
      </Button>
    </div>
  );
}
