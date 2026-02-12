"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Course } from "@/lib/content/types";
import { enrollInCourse } from "@/lib/actions/progress";
import { UnitCard } from "@/components/learning-path/unit-card";
import { LessonNode } from "@/components/learning-path/lesson-node";
import { PathConnector } from "@/components/learning-path/path-connector";
import { Button } from "@/components/ui/button";
import { getLanguageName } from "@/lib/languages";

interface LearningPathProps {
  course: Course;
  enrollment: {
    currentUnitId: string | null;
    currentLessonIndex: number;
  } | null;
  completions: {
    unitId: string;
    lessonIndex: number;
  }[];
}

function isLessonCompleted(
  completions: { unitId: string; lessonIndex: number }[],
  unitId: string,
  lessonIndex: number
) {
  return completions.some(
    (c) => c.unitId === unitId && c.lessonIndex === lessonIndex
  );
}

function findFirstIncompleteLesson(
  unit: Course["units"][number],
  completions: { unitId: string; lessonIndex: number }[]
) {
  for (let li = 0; li < unit.lessons.length; li++) {
    if (!isLessonCompleted(completions, unit.id, li)) {
      return li;
    }
  }
  return unit.lessons.length; // all complete
}

export function LearningPath({
  course,
  enrollment,
  completions,
}: LearningPathProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  const languageLabel = `${getLanguageName(course.sourceLanguage)} → ${getLanguageName(course.targetLanguage)}`;

  if (!enrollment) {
    return (
      <div className="flex flex-col items-center py-12">
        <p className="mb-6 text-lg text-lingo-text-light">
          Ready to start learning {course.title.split(" ")[0]}?
        </p>
        <Button
          loading={isPending}
          onClick={() => {
            startTransition(async () => {
              await enrollInCourse(course.id);
              router.refresh();
            });
          }}
        >
          Start Course
        </Button>
      </div>
    );
  }

  // Unit selector view
  if (selectedUnitId === null) {
    return (
      <div className="grid gap-4">
        {course.units.map((unit) => {
          const completedLessons = unit.lessons.filter((_, li) =>
            isLessonCompleted(completions, unit.id, li)
          ).length;

          return (
            <UnitCard
              key={unit.id}
              title={unit.title}
              description={unit.description}
              icon={unit.icon}
              color={unit.color}
              totalLessons={unit.lessons.length}
              completedLessons={completedLessons}
              languageLabel={languageLabel}
              language={course.targetLanguage}
              onClick={() => setSelectedUnitId(unit.id)}
            />
          );
        })}
      </div>
    );
  }

  // Lesson path view for selected unit
  const unit = course.units.find((u) => u.id === selectedUnitId);
  if (!unit) return null;

  const completedLessons = unit.lessons.filter((_, li) =>
    isLessonCompleted(completions, unit.id, li)
  ).length;
  const currentLessonIndex = findFirstIncompleteLesson(unit, completions);

  return (
    <div>
      <button
        onClick={() => setSelectedUnitId(null)}
        className="mb-4 flex items-center gap-1 text-sm font-bold text-lingo-text-light hover:text-lingo-text transition-colors"
      >
        ← All paths
      </button>

      <UnitCard
        title={unit.title}
        description={unit.description}
        icon={unit.icon}
        color={unit.color}
        totalLessons={unit.lessons.length}
        completedLessons={completedLessons}
        languageLabel={languageLabel}
        language={course.targetLanguage}
      >
        {unit.lessons.map((lesson, lessonIndex) => {
          const completed = isLessonCompleted(completions, unit.id, lessonIndex);
          const isCurrent = lessonIndex === currentLessonIndex;
          const isLocked = lessonIndex > currentLessonIndex;

          const state = completed
            ? "completed"
            : isCurrent
              ? "current"
              : isLocked
                ? "locked"
                : "current";

          return (
            <div key={lessonIndex}>
              {lessonIndex > 0 && (
                <PathConnector
                  color={unit.color}
                  completed={completed}
                />
              )}
              <LessonNode
                title={lesson.title}
                state={state}
                href={`/lesson/${course.id}/${unit.id}/${lessonIndex}`}
                color={unit.color}
                index={lessonIndex}
                language={course.targetLanguage}
              />
            </div>
          );
        })}
      </UnitCard>
    </div>
  );
}
