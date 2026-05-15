import { parseUnitMarkdown } from "../../../../lib/content/unit-parser";
import type { UnitLesson } from "../../../../lib/content/types";

export function getUnitLessons(markdown: string): UnitLesson[] {
  return parseUnitMarkdown(markdown).lessons;
}

export function getUnitLessonsSafe(markdown: string): {
  lessons: UnitLesson[];
  parseError: boolean;
} {
  try {
    return { lessons: parseUnitMarkdown(markdown).lessons, parseError: false };
  } catch {
    return { lessons: [], parseError: true };
  }
}
