import Link from "next/link";
import type { CourseListItem } from "@/lib/content/types";
import { getLanguageName } from "@/lib/languages";

interface CourseCardProps {
  course: CourseListItem;
}

export function CourseCard({ course }: CourseCardProps) {
  return (
    <Link
      href={`/units/${course.id}`}
      className="block rounded-2xl border-2 border-lingo-border bg-lingo-card p-5 transition-transform hover:scale-[1.02] active:scale-[0.98]"
    >
      <h3 className="text-lg font-bold text-lingo-text">{course.title}</h3>
      <p className="mt-1 text-sm text-lingo-text-light">
        {getLanguageName(course.sourceLanguage)} →{" "}
        {getLanguageName(course.targetLanguage)}
      </p>
      <div className="mt-3 flex items-center gap-2">
        <span className="inline-flex items-center rounded-full bg-lingo-blue px-3 py-1 text-xs font-bold text-white">
          {course.level}
        </span>
        <span className="text-xs text-lingo-text-light">
          {course.unitCount} {course.unitCount === 1 ? "unit" : "units"} · {course.lessonCount}{" "}
          {course.lessonCount === 1 ? "lesson" : "lessons"}
        </span>
      </div>
    </Link>
  );
}
