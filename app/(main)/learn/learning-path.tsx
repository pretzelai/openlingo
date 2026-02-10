"use client";

import { useTransition } from "react";
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

export function LearningPath({
  course,
  enrollment,
  completions,
}: LearningPathProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

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

  // Determine current position: first incomplete lesson
  let currentUnitIndex = 0;
  let currentLessonIndex = 0;
  let found = false;

  for (let ui = 0; ui < course.units.length && !found; ui++) {
    for (let li = 0; li < course.units[ui].lessons.length; li++) {
      if (!isLessonCompleted(completions, ui, li)) {
        currentUnitIndex = ui;
        currentLessonIndex = li;
        found = true;
        break;
      }
    }
  }

  return (
    <div>
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
          >
            {unit.lessons.map((lesson, lessonIndex) => {
              const completed = isLessonCompleted(completions, unitIndex, lessonIndex);
              const isCurrent =
                unitIndex === currentUnitIndex && lessonIndex === currentLessonIndex;
              const isLocked =
                unitIndex > currentUnitIndex ||
                (unitIndex === currentUnitIndex && lessonIndex > currentLessonIndex);

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
                    href={`/lesson/${course.id}/${unitIndex}/${lessonIndex}`}
                    color={unit.color}
                    index={lessonIndex}
                  />
                </div>
              );
            })}
          </UnitCard>
        );
      })}
    </div>
  );
}
