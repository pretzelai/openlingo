"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Course } from "@/lib/content/types";
import { enrollInCourse } from "@/lib/actions/progress";
import { UnitCard } from "@/components/learning-path/unit-card";
import { LessonNode } from "@/components/learning-path/lesson-node";
import { PathConnector } from "@/components/learning-path/path-connector";
import { Button } from "@/components/ui/button";

interface LearningPathProps {
  course: Course;
  enrollment: {
    currentUnitIndex: number;
    currentLessonIndex: number;
  } | null;
  completions: {
    unitIndex: number;
    lessonIndex: number;
  }[];
}

function isLessonCompleted(
  completions: { unitIndex: number; lessonIndex: number }[],
  unitIndex: number,
  lessonIndex: number
) {
  return completions.some(
    (c) => c.unitIndex === unitIndex && c.lessonIndex === lessonIndex
  );
}

function findFirstIncompleteLesson(
  unit: Course["units"][number],
  unitIndex: number,
  completions: { unitIndex: number; lessonIndex: number }[]
) {
  for (let li = 0; li < unit.lessons.length; li++) {
    if (!isLessonCompleted(completions, unitIndex, li)) {
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
  const [selectedUnitIndex, setSelectedUnitIndex] = useState<number | null>(null);

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
  if (selectedUnitIndex === null) {
    return (
      <div className="grid gap-4">
        {course.units.map((unit, unitIndex) => {
          const completedLessons = unit.lessons.filter((_, li) =>
            isLessonCompleted(completions, unitIndex, li)
          ).length;

          return (
            <UnitCard
              key={unitIndex}
              title={unit.title}
              description={unit.description}
              icon={unit.icon}
              color={unit.color}
              unitIndex={unitIndex}
              totalLessons={unit.lessons.length}
              completedLessons={completedLessons}
              onClick={() => setSelectedUnitIndex(unitIndex)}
            />
          );
        })}
      </div>
    );
  }

  // Lesson path view for selected unit
  const unit = course.units[selectedUnitIndex];
  const completedLessons = unit.lessons.filter((_, li) =>
    isLessonCompleted(completions, selectedUnitIndex, li)
  ).length;
  const currentLessonIndex = findFirstIncompleteLesson(unit, selectedUnitIndex, completions);

  return (
    <div>
      <button
        onClick={() => setSelectedUnitIndex(null)}
        className="mb-4 flex items-center gap-1 text-sm font-bold text-lingo-text-light hover:text-lingo-text transition-colors"
      >
        ← All paths
      </button>

      <UnitCard
        title={unit.title}
        description={unit.description}
        icon={unit.icon}
        color={unit.color}
        unitIndex={selectedUnitIndex}
        totalLessons={unit.lessons.length}
        completedLessons={completedLessons}
      >
        {unit.lessons.map((lesson, lessonIndex) => {
          const completed = isLessonCompleted(completions, selectedUnitIndex, lessonIndex);
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
                href={`/lesson/${course.id}/${selectedUnitIndex}/${lessonIndex}`}
                color={unit.color}
                index={lessonIndex}
              />
            </div>
          );
        })}
      </UnitCard>
    </div>
  );
}
