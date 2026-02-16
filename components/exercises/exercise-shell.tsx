"use client";

import { useEffect, useCallback, useRef } from "react";
import type { ExerciseStatus } from "@/hooks/use-exercise";
import { Button } from "@/components/ui/button";
import { HoverableText } from "@/components/word/hoverable-text";
import Markdown from "react-markdown";

interface ExerciseShellProps {
  children: React.ReactNode;
  status: ExerciseStatus;
  onCheck: () => void;
  onContinue: () => void;
  canCheck: boolean;
  correctAnswer?: string;
  /** Correct answer with **bold** markers on differing chars */
  correctedMarkdown?: string;
  language?: string;
}

export function ExerciseShell({
  children,
  status,
  onCheck,
  onContinue,
  canCheck,
  correctAnswer,
  correctedMarkdown,
  language,
}: ExerciseShellProps) {
  const justCheckedRef = useRef(false);

  // When status changes away from "answering", mark that we just checked
  // and clear the flag after a short delay to allow the user to see feedback
  useEffect(() => {
    if (status === "correct" || status === "incorrect") {
      justCheckedRef.current = true;
      const timer = setTimeout(() => {
        justCheckedRef.current = false;
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key !== "Enter") return;
      if (status === "answering" && canCheck) {
        e.preventDefault();
        onCheck();
      } else if ((status === "correct" || status === "incorrect") && !justCheckedRef.current) {
        e.preventDefault();
        onContinue();
      }
    },
    [status, canCheck, onCheck, onContinue]
  );

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div className="flex flex-col min-h-[400px]">
      <div className="flex-1">{children}</div>

      {status === "answering" && (
        <div className="mt-6">
          <Button
            onClick={onCheck}
            disabled={!canCheck}
            className="w-full"
          >
            Check
          </Button>
        </div>
      )}

      {status === "correct" && (
        <div className="mt-6">
          <div className="rounded-xl bg-green-50 border-2 border-lingo-green p-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">&#10003;</span>
              <span className="font-bold text-lingo-green">Correct!</span>
            </div>
          </div>
          <Button onClick={onContinue} className="w-full">
            Continue
          </Button>
        </div>
      )}

      {status === "incorrect" && (
        <div className="mt-6">
          <div className="rounded-xl bg-red-50 border-2 border-lingo-red p-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-2xl">&#10007;</span>
              <span className="font-bold text-lingo-red">Incorrect</span>
            </div>
            {correctAnswer && (
              <p className="mt-1 text-sm text-lingo-text">
                Correct answer:{" "}
                {correctedMarkdown ? (
                  <Markdown>{correctedMarkdown}</Markdown>
                ) : (
                  <strong>{language ? <HoverableText text={correctAnswer} language={language} /> : correctAnswer}</strong>
                )}
              </p>
            )}
          </div>
          <Button variant="danger" onClick={onContinue} className="w-full">
            Continue
          </Button>
        </div>
      )}
    </div>
  );
}
