import matter from "gray-matter";
import { parseExercisesFromMarkdown } from "./parser";
import type { ParsedUnit, UnitLesson } from "./types";

/**
 * Parse a self-contained unit markdown file.
 *
 * Format:
 * ```
 * ---
 * unitTitle: "..."
 * description: "..."
 * icon: "📘"
 * color: "#4CAF50"
 * targetLanguage: "de"
 * sourceLanguage: "en"
 * level: "B1"
 * courseId: "optional-uuid"
 * ---
 *
 * ---
 * lessonTitle: "Lesson 1"
 * description: "Learn greetings"
 * icon: "👋"
 * color: "#FF9600"
 * ---
 *
 * [multiple-choice]
 * ...
 * ```
 */
export function parseUnitMarkdown(raw: string): ParsedUnit {
  const { data: fm, content } = matter(raw);

  // Find all --- delimited lesson metadata blocks in the content
  const lessonBlockRegex = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*$/gm;
  const blocks: { meta: string; start: number; end: number }[] = [];

  let match;
  while ((match = lessonBlockRegex.exec(content)) !== null) {
    blocks.push({
      meta: match[1],
      start: match.index,
      end: match.index + match[0].length,
    });
  }

  const lessons: UnitLesson[] = blocks.map((block, i) => {
    const nextStart =
      i + 1 < blocks.length ? blocks[i + 1].start : content.length;
    const exerciseContent = content.slice(block.end, nextStart).trim();

    let meta: Record<string, unknown> = {};
    try {
      const { data } = matter(`---\n${block.meta}\n---`);
      meta = data;
    } catch {
      // If YAML parse fails, skip metadata
    }

    return {
      title: (meta.lessonTitle as string) ?? "Untitled",
      description: (meta.description as string) ?? undefined,
      icon: (meta.icon as string) ?? undefined,
      color: (meta.color as string) ?? undefined,
      exercises: parseExercisesFromMarkdown(exerciseContent),
    };
  });

  return {
    title: fm.unitTitle ?? fm.title ?? "Untitled",
    description: fm.description ?? "",
    icon: fm.icon ?? "📘",
    color: fm.color ?? "#4CAF50",
    targetLanguage: fm.targetLanguage ?? null,
    sourceLanguage: fm.sourceLanguage ?? null,
    level: fm.level ?? null,
    courseId: fm.courseId ?? null,
    lessons,
  };
}
