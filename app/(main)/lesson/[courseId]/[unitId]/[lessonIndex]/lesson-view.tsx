"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { UnitLesson, Exercise } from "@/lib/content/types";
import { useLesson } from "@/hooks/use-lesson";
import { ProgressBar } from "@/components/ui/progress-bar";
import { MultipleChoice } from "@/components/exercises/multiple-choice";
import { Translation } from "@/components/exercises/translation";
import { FillInTheBlank } from "@/components/exercises/fill-in-the-blank";
import { MatchingPairs } from "@/components/exercises/matching-pairs";
import { Listening } from "@/components/exercises/listening";
import { WordBank } from "@/components/exercises/word-bank";
import { Speaking } from "@/components/exercises/speaking";
import { HoverableText } from "@/components/word/hoverable-text";
import { LessonCompleteModal } from "@/components/gamification/lesson-complete-modal";
import { completeLesson } from "@/lib/actions/lesson";

interface LessonViewProps {
  courseId: string;
  unitId: string;
  lessonIndex: number;
  lesson: UnitLesson;
  lessonTitle: string;
  unitTitle: string;
  targetLanguage: string;
}

export function LessonView({
  courseId,
  unitId,
  lessonIndex,
  lesson,
  lessonTitle,
  unitTitle,
  targetLanguage,
}: LessonViewProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showComplete, setShowComplete] = useState(false);
  const [lessonResult, setLessonResult] = useState<{
    xpEarned: number;
    perfectScore: boolean;
    heartsLost: number;
  } | null>(null);

  const {
    currentIndex,
    totalExercises,
    currentExercise,
    results,
    isComplete,
    heartsLost,
    recordResult,
    advance,
  } = useLesson(lesson.exercises);

  const progress = ((currentIndex) / totalExercises) * 100;

  function handleResult(correct: boolean, answer: string) {
    recordResult(correct, answer);
  }

  function handleContinue() {
    advance();
  }

  // When lesson completes, submit results
  if (isComplete && !showComplete) {
    startTransition(async () => {
      const result = await completeLesson({
        unitId,
        lessonIndex,
        xpReward: lesson.xpReward,
        results: results.map((r) => ({
          exerciseIndex: r.exerciseIndex,
          exerciseType: r.exerciseType,
          correct: r.correct,
          userAnswer: r.userAnswer,
        })),
        heartsLost,
      });
      setLessonResult(result);
      setShowComplete(true);
    });
  }

  if (showComplete && lessonResult) {
    return (
      <LessonCompleteModal
        xpEarned={lessonResult.xpEarned}
        perfectScore={lessonResult.perfectScore}
        heartsLost={lessonResult.heartsLost}
        onContinue={() => router.push(`/learn/${courseId}?unit=${unitId}`)}
      />
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      {/* Header */}
      <div className="mb-6 flex items-center gap-4">
        <button
          onClick={() => router.push(`/learn/${courseId}?unit=${unitId}`)}
          className="text-lingo-text-light hover:text-lingo-text"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
        <ProgressBar value={progress} className="flex-1" />
      </div>

      <p className="text-sm text-lingo-text-light mb-1"><HoverableText text={unitTitle} language={targetLanguage} /></p>
      <h1 className="text-xl font-bold text-lingo-text mb-6"><HoverableText text={lessonTitle} language={targetLanguage} /></h1>

      {/* Exercise */}
      {!isComplete && (
        <ExerciseRenderer
          key={currentIndex}
          exercise={currentExercise}
          onResult={handleResult}
          onContinue={handleContinue}
          language={targetLanguage}
        />
      )}

      {isComplete && !showComplete && (
        <div className="flex items-center justify-center py-12">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-lingo-green border-t-transparent" />
        </div>
      )}
    </div>
  );
}

function ExerciseRenderer({
  exercise,
  onResult,
  onContinue,
  language,
}: {
  exercise: Exercise;
  onResult: (correct: boolean, answer: string) => void;
  onContinue: () => void;
  language: string;
}) {
  switch (exercise.type) {
    case "multiple-choice":
      return (
        <MultipleChoice
          exercise={exercise}
          onResult={onResult}
          onContinue={onContinue}
          language={language}
        />
      );
    case "translation":
      return (
        <Translation
          exercise={exercise}
          onResult={onResult}
          onContinue={onContinue}
          language={language}
        />
      );
    case "fill-in-the-blank":
      return (
        <FillInTheBlank
          exercise={exercise}
          onResult={onResult}
          onContinue={onContinue}
          language={language}
        />
      );
    case "matching-pairs":
      return (
        <MatchingPairs
          exercise={exercise}
          onResult={onResult}
          onContinue={onContinue}
          language={language}
        />
      );
    case "listening":
      return (
        <Listening
          exercise={exercise}
          onResult={onResult}
          onContinue={onContinue}
          language={language}
        />
      );
    case "word-bank":
      return (
        <WordBank
          exercise={exercise}
          onResult={onResult}
          onContinue={onContinue}
          language={language}
        />
      );
    case "speaking":
      return (
        <Speaking
          exercise={exercise}
          onResult={onResult}
          onContinue={onContinue}
          language={language}
        />
      );
  }
}
