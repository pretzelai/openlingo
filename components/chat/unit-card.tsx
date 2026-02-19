"use client";

import { useRouter } from "next/navigation";
import { getUnitColor } from "@/lib/colors";

interface ChatUnitCardProps {
  courseId: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  level: string;
  lessonCount: number;
  exerciseCount: number;
  lessonTitles: string[];
}

export function ChatUnitCard({
  courseId,
  title,
  description,
  icon,
  level,
  lessonCount,
  exerciseCount,
  lessonTitles,
}: ChatUnitCardProps) {
  const router = useRouter();
  const color = getUnitColor(0);

  return (
    <div className="w-full overflow-hidden rounded-xl border-2 border-lingo-border bg-white">
      {/* Header */}
      <div className="flex items-start gap-3 px-4 py-3">
        <span className="text-3xl">{icon}</span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-sm font-bold text-lingo-text">
              {title}
            </h3>
            <span
              className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ring-1"
              style={{
                backgroundColor: color + "1a",
                color,
                boxShadow: `inset 0 0 0 1px ${color}33`,
              }}
            >
              {level}
            </span>
          </div>
          <p className="mt-0.5 text-xs text-lingo-text-light">{description}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-4 border-t border-lingo-border/50 px-4 py-2">
        <div className="flex items-center gap-1.5 text-xs text-lingo-text-light">
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
            />
          </svg>
          {lessonCount} lessons
        </div>
        <div className="flex items-center gap-1.5 text-xs text-lingo-text-light">
          <svg
            className="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          {exerciseCount} exercises
        </div>
      </div>

      {/* Lesson list */}
      <div className="border-t border-lingo-border/50 px-4 py-2">
        <ol className="space-y-1">
          {lessonTitles.map((lessonTitle, i) => (
            <li
              key={i}
              className="flex items-center gap-2 text-xs text-lingo-text"
            >
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                style={{ backgroundColor: getUnitColor(i) }}
              >
                {i + 1}
              </span>
              {lessonTitle}
            </li>
          ))}
        </ol>
      </div>

      {/* Start button */}
      <div className="border-t border-lingo-border/50 px-4 py-3">
        <button
          type="button"
          onClick={() => router.push(`/units/${courseId}`)}
          className="w-full rounded-xl bg-lingo-green py-2.5 text-sm font-bold text-white shadow-[0_4px_0_0] shadow-lingo-green-dark active:translate-y-[2px] active:shadow-[0_2px_0_0] active:shadow-lingo-green-dark transition-all"
        >
          Start Learning
        </button>
      </div>
    </div>
  );
}
