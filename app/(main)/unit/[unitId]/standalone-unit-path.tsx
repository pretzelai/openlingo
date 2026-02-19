"use client";

import type { UnitWithContent } from "@/lib/content/types";
import { UnitCard } from "@/components/learning-path/unit-card";
import { LessonNode } from "@/components/learning-path/lesson-node";
import { PathConnector } from "@/components/learning-path/path-connector";
import { getUnitColor } from "@/lib/colors";

interface StandaloneUnitPathProps {
  unit: UnitWithContent;
  completions: { unitId: string; lessonIndex: number }[];
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
  unitId: string,
  lessonCount: number,
  completions: { unitId: string; lessonIndex: number }[]
) {
  for (let li = 0; li < lessonCount; li++) {
    if (!isLessonCompleted(completions, unitId, li)) {
      return li;
    }
  }
  return lessonCount;
}

export function StandaloneUnitPath({
  unit,
  completions,
}: StandaloneUnitPathProps) {
  const unitColor = getUnitColor(0);
  const completedLessons = unit.lessons.filter((_, li) =>
    isLessonCompleted(completions, unit.id, li)
  ).length;
  const currentLessonIndex = findFirstIncompleteLesson(
    unit.id,
    unit.lessons.length,
    completions
  );

  return (
    <UnitCard
      title={unit.title}
      description={unit.description}
      icon={unit.icon}
      color={unitColor}
      totalLessons={unit.lessons.length}
      completedLessons={completedLessons}
      language={unit.targetLanguage}
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
              <PathConnector color={unitColor} completed={completed} />
            )}
            <LessonNode
              title={lesson.title}
              state={state}
              href={`/unit/${unit.id}/lesson/${lessonIndex}`}
              color={unitColor}
              index={lessonIndex}
              language={unit.targetLanguage}
            />
          </div>
        );
      })}
    </UnitCard>
  );
}
