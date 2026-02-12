"use client";

import Link from "next/link";
import { HoverableText } from "@/components/word/hoverable-text";

type LessonState = "completed" | "current" | "locked";

interface LessonNodeProps {
  title: string;
  state: LessonState;
  href: string;
  color: string;
  index: number;
  language?: string;
}

export function LessonNode({ title, state, href, color, index, language }: LessonNodeProps) {
  // Zigzag pattern: offset nodes left/right alternately
  const offset = index % 2 === 0 ? "-translate-x-8" : "translate-x-8";

  if (state === "locked") {
    return (
      <div className={`flex flex-col items-center ${offset}`}>
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-lingo-gray border-b-4 border-lingo-gray-dark cursor-not-allowed opacity-60">
          <svg className="h-6 w-6 text-lingo-gray-dark" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
          </svg>
        </div>
        <span className="mt-2 text-xs font-bold text-lingo-gray-dark">
          {language ? <HoverableText text={title} language={language} /> : title}
        </span>
      </div>
    );
  }

  return (
    <div className={`flex flex-col items-center ${offset}`}>
      <Link href={href} className="group">
        <div
          className={`flex h-16 w-16 items-center justify-center rounded-full border-b-4 transition-transform group-hover:scale-110 ${
            state === "completed"
              ? "bg-lingo-yellow border-yellow-500"
              : "border-b-4 animate-pulse-glow"
          }`}
          style={
            state === "current"
              ? { backgroundColor: color, borderColor: color + "cc" }
              : undefined
          }
        >
          {state === "completed" ? (
            <svg className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
            </svg>
          ) : (
            <svg className="h-7 w-7 text-white" fill="currentColor" viewBox="0 0 24 24">
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
        </div>
      </Link>
      <span
        className={`mt-2 text-xs font-bold ${
          state === "completed"
            ? "text-lingo-yellow"
            : state === "current"
              ? "text-lingo-text"
              : "text-lingo-gray-dark"
        }`}
      >
        {language ? <HoverableText text={title} language={language} /> : title}
      </span>
    </div>
  );
}
