import fs from "fs";
import path from "path";
import { parseUnitMarkdown } from "./unit-parser";
import { parseCourseMarkdown } from "./course-parser";
import type { ParsedUnit, ParsedCourse, UnitLesson } from "./types";

export { parseUnitMarkdown } from "./unit-parser";
export { parseCourseMarkdown } from "./course-parser";

const CONTENT_DIR = path.join(process.cwd(), "content");

// ---------------------------------------------------------------------------
// Convenience helpers (used by read paths that store markdown in DB)
// ---------------------------------------------------------------------------

/** Parse raw unit markdown into UnitLesson[]. */
export function getUnitLessons(markdown: string): UnitLesson[] {
  return parseUnitMarkdown(markdown).lessons;
}

// ---------------------------------------------------------------------------
// Content directory scanner
// ---------------------------------------------------------------------------

export interface LoadedCourse {
  id: string;
  title: string;
  sourceLanguage: string;
  targetLanguage: string;
  level: string;
  description: string;
}

export interface LoadedUnit {
  parsed: ParsedUnit;
  markdown: string;
}

/**
 * Scan content directory. Courses are `*-course.md`, units are `*-unit-*.md`.
 *
 * Course ID is derived from filename: `testing-course.md` → `testing`.
 * Unit ID is derived from filename: `testing-unit-0.md` → `testing-unit-0`.
 */
export function loadContentDir(): { courses: LoadedCourse[]; units: LoadedUnit[] } {
  if (!fs.existsSync(CONTENT_DIR)) return { courses: [], units: [] };

  const entries = fs.readdirSync(CONTENT_DIR).filter((f) => f.endsWith(".md")).sort();
  const courses: LoadedCourse[] = [];
  const units: LoadedUnit[] = [];

  for (const entry of entries) {
    const fullPath = path.join(CONTENT_DIR, entry);
    if (!fs.statSync(fullPath).isFile()) continue;

    const raw = fs.readFileSync(fullPath, "utf-8");

    if (entry.endsWith("-course.md")) {
      try {
        const parsed = parseCourseMarkdown(raw);
        const id = parsed.id ?? entry.replace(/-course\.md$/, "");
        courses.push({
          id,
          title: parsed.courseTitle,
          sourceLanguage: parsed.sourceLanguage,
          targetLanguage: parsed.targetLanguage,
          level: parsed.level,
          description: parsed.description,
        });
      } catch {
        // skip malformed
      }
    } else {
      try {
        const parsed = parseUnitMarkdown(raw);
        units.push({ parsed, markdown: raw });
      } catch {
        // skip malformed
      }
    }
  }

  return { courses, units };
}
