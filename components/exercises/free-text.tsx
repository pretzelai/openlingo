"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import Markdown from "react-markdown";
import type { FreeTextExercise } from "@/lib/content/types";
import { Button } from "@/components/ui/button";
import { HoverableText } from "@/components/word/hoverable-text";

interface Props {
  exercise: FreeTextExercise;
  onResult: (correct: boolean, answer: string) => void;
  onContinue: () => void;
  language: string;
}

type Phase = "writing" | "loading" | "result";

export function FreeText({ exercise, onResult, onContinue, language }: Props) {
  const [phase, setPhase] = useState<Phase>("writing");
  const [userText, setUserText] = useState("");
  const [aiResponse, setAiResponse] = useState("");
  const [correct, setCorrect] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const onResultRef = useRef(onResult);
  onResultRef.current = onResult;

  const handleSubmit = useCallback(async () => {
    if (!userText.trim()) return;
    setPhase("loading");
    setError(null);

    const prompt = exercise.afterSubmitPrompt.replace(
      /\{userResponse\}/g,
      userText.trim()
    );

    try {
      const res = await fetch("/api/ai-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt }),
      });
      if (!res.ok) throw new Error("AI request failed");
      const data = await res.json();
      const raw = data.result as string;
      // Strip PASSED/FAILED verdict from displayed text
      const display = raw.replace(/\b(PASSED|FAILED)\b/g, "").trim();
      setAiResponse(display);
      setPhase("result");
      const hasFailed = /\bFAILED\b/.test(raw);
      const passed = !hasFailed;
      setCorrect(passed);
      onResultRef.current(passed, userText.trim());
    } catch {
      setError("Something went wrong. Please try again.");
      setPhase("writing");
    }
  }, [userText, exercise.afterSubmitPrompt]);

  const handleContinue = useCallback(() => {
    onContinue();
  }, [onContinue]);

  // Enter key submits in writing phase (Shift+Enter for newline)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === "Enter" && !e.shiftKey && phase === "writing") {
        e.preventDefault();
        handleSubmit();
      }
    },
    [phase, handleSubmit]
  );

  // Global Enter to continue in result phase
  useEffect(() => {
    if (phase !== "result") return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault();
        handleContinue();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [phase, handleContinue]);

  return (
    <div className="flex flex-col min-h-[400px]">
      <div className="flex-1">
        <h2 className="text-xl font-bold text-lingo-text mb-6">
          <HoverableText text={exercise.text} language={language} noAudio />
        </h2>

        {(phase === "writing" || phase === "loading") && (
          <textarea
            value={userText}
            onChange={(e) => setUserText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={phase === "loading"}
            placeholder="Type your answer here..."
            className="w-full rounded-xl border-2 border-lingo-border bg-white p-4 text-lingo-text placeholder:text-lingo-text-light/50 focus:border-lingo-blue focus:outline-none min-h-[120px] resize-y disabled:opacity-50"
            autoFocus
          />
        )}

        {error && (
          <p className="text-center text-sm text-lingo-red mt-2">{error}</p>
        )}

        {phase === "result" && (
          <>
            <div className={`rounded-xl p-4 mb-4 border-2 ${correct ? "bg-green-50 border-lingo-green" : "bg-red-50 border-lingo-red"}`}>
              <div className="flex items-center gap-2">
                <span className="text-2xl">{correct ? "\u2713" : "\u2717"}</span>
                <span className={`font-bold ${correct ? "text-lingo-green" : "text-lingo-red"}`}>
                  {correct ? "Good job!" : "Not quite"}
                </span>
              </div>
            </div>
            <div className="rounded-xl border-2 border-lingo-border bg-white p-4">
              <div className="prose prose-sm max-w-none text-lingo-text [&_strong]:text-lingo-text [&_h1]:text-lg [&_h2]:text-base [&_h3]:text-sm [&_ul]:list-disc [&_ol]:list-decimal [&_li]:ml-4">
                <Markdown>{aiResponse}</Markdown>
              </div>
            </div>
          </>
        )}
      </div>

      <div className="mt-6">
        {phase === "writing" && (
          <Button
            onClick={handleSubmit}
            disabled={!userText.trim()}
            className="w-full"
          >
            Submit
          </Button>
        )}

        {phase === "loading" && (
          <Button loading className="w-full">
            Submit
          </Button>
        )}

        {phase === "result" && (
          <Button variant={correct ? "primary" : "danger"} onClick={handleContinue} className="w-full">
            Continue
          </Button>
        )}
      </div>
    </div>
  );
}
