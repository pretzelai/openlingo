import Link from "next/link";
import type { EnrolledCourseInfo } from "@/lib/content/types";
import { getLanguageName } from "@/lib/languages";

interface ContinueLearningProps {
  courses: EnrolledCourseInfo[];
}

export function ContinueLearning({ courses }: ContinueLearningProps) {
  if (courses.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-4 text-xl font-black text-lingo-text">
        Continue Learning
      </h2>
      <div className="grid gap-3">
        {courses.map((course) => {
          const progress =
            course.lessonCount > 0
              ? Math.round(
                  (course.completedLessons / course.lessonCount) * 100
                )
              : 0;

          return (
            <Link
              key={course.id}
              href={`/learn/${course.id}`}
              className="flex items-center gap-4 rounded-2xl border-2 border-lingo-border bg-lingo-card p-4 transition-transform hover:scale-[1.01] active:scale-[0.99]"
            >
              <div className="min-w-0 flex-1">
                <h3 className="font-bold text-lingo-text">{course.title}</h3>
                <p className="text-sm text-lingo-text-light">
                  {getLanguageName(course.sourceLanguage)} →{" "}
                  {getLanguageName(course.targetLanguage)}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 w-20 rounded-full bg-lingo-gray overflow-hidden">
                  <div
                    className="h-full rounded-full bg-lingo-green transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-lingo-green">
                  {progress}%
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
