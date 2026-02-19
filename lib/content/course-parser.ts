import matter from "gray-matter";
import type { ParsedCourse } from "./types";

/**
 * Parse a course markdown file.
 *
 * Format:
 * ```
 * ---
 * courseTitle: "German Testing"
 * description: "A test course for German exercises"
 * sourceLanguage: "en"
 * targetLanguage: "de"
 * level: "B1"
 * ---
 * ```
 *
 * The course ID is derived from the filename (e.g. `testing-course.md` → `testing`).
 * Units reference the course via `courseId` in their own frontmatter.
 */
export function parseCourseMarkdown(raw: string): ParsedCourse {
  const { data: fm } = matter(raw);

  if (!fm.courseTitle) {
    throw new Error("Course markdown must have a courseTitle in frontmatter");
  }

  return {
    id: fm.id ?? null,
    courseTitle: fm.courseTitle,
    description: fm.description ?? "",
    sourceLanguage: fm.sourceLanguage ?? "en",
    targetLanguage: fm.targetLanguage ?? "en",
    level: fm.level ?? "A1",
  };
}
