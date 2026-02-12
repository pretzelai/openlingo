"use client";

import { useState } from "react";
import type { CourseListItem } from "@/lib/content/types";
import { getLanguageName } from "@/lib/languages";
import { CourseCard } from "./course-card";

interface CourseBrowserProps {
  courses: CourseListItem[];
  filters: {
    sourceLanguages: string[];
    targetLanguages: string[];
    levels: string[];
  };
}

export function CourseBrowser({ courses, filters }: CourseBrowserProps) {
  const [sourceLanguage, setSourceLanguage] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("");
  const [level, setLevel] = useState("");

  const filtered = courses.filter((c) => {
    if (sourceLanguage && c.sourceLanguage !== sourceLanguage) return false;
    if (targetLanguage && c.targetLanguage !== targetLanguage) return false;
    if (level && c.level !== level) return false;
    return true;
  });

  const hasFilters =
    filters.sourceLanguages.length > 1 ||
    filters.targetLanguages.length > 1 ||
    filters.levels.length > 1;

  return (
    <section>
      <h2 className="mb-4 text-xl font-black text-lingo-text">
        Browse Courses
      </h2>

      {hasFilters && (
        <div className="mb-4 flex flex-wrap gap-2">
          {filters.sourceLanguages.length > 1 && (
            <select
              value={sourceLanguage}
              onChange={(e) => setSourceLanguage(e.target.value)}
              className="rounded-lg border-2 border-lingo-border bg-lingo-card px-3 py-2 text-sm font-bold text-lingo-text"
            >
              <option value="">All source languages</option>
              {filters.sourceLanguages.map((lang) => (
                <option key={lang} value={lang}>
                  {getLanguageName(lang)}
                </option>
              ))}
            </select>
          )}
          {filters.targetLanguages.length > 1 && (
            <select
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className="rounded-lg border-2 border-lingo-border bg-lingo-card px-3 py-2 text-sm font-bold text-lingo-text"
            >
              <option value="">All target languages</option>
              {filters.targetLanguages.map((lang) => (
                <option key={lang} value={lang}>
                  {getLanguageName(lang)}
                </option>
              ))}
            </select>
          )}
          {filters.levels.length > 1 && (
            <select
              value={level}
              onChange={(e) => setLevel(e.target.value)}
              className="rounded-lg border-2 border-lingo-border bg-lingo-card px-3 py-2 text-sm font-bold text-lingo-text"
            >
              <option value="">All levels</option>
              {filters.levels.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <p className="py-8 text-center text-lingo-text-light">
          No courses match your filters.
        </p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {filtered.map((course) => (
            <CourseCard key={course.id} course={course} />
          ))}
        </div>
      )}
    </section>
  );
}
