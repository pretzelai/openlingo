"use client";

import Link from "next/link";
import type { StandaloneUnitInfo } from "@/lib/content/types";
import { getLanguageName } from "@/lib/languages";
import { getUnitColor } from "@/lib/colors";

interface StandaloneUnitsProps {
  units: StandaloneUnitInfo[];
}

export function StandaloneUnits({ units }: StandaloneUnitsProps) {
  if (units.length === 0) return null;

  return (
    <section className="mb-8">
      <h2 className="mb-3 text-lg font-bold text-lingo-text">My Units</h2>
      <div className="grid min-w-0 gap-3">
        {units.map((unit, i) => {
          const color = getUnitColor(i);
          const progress =
            unit.lessonCount > 0
              ? (unit.completedLessons / unit.lessonCount) * 100
              : 0;
          const isPublic = unit.visibility === "public";

          return (
            <div
              key={unit.id}
              className="min-w-0 overflow-hidden rounded-xl border-2 border-lingo-border bg-white shadow-[0_2px_0_0] shadow-lingo-border transition-all hover:border-lingo-green hover:bg-lingo-green/5"
            >
              <Link
                href={`/unit/${unit.id}`}
                className="flex min-w-0 items-center gap-3 p-4"
              >
                <div
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl"
                  style={{ backgroundColor: `${color}20` }}
                >
                  {unit.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-bold text-lingo-text truncate">
                      {unit.title}
                    </p>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        isPublic
                          ? "bg-lingo-green/15 text-lingo-green"
                          : "bg-lingo-gray text-lingo-text-light"
                      }`}
                    >
                      {isPublic ? "Public" : "Private"}
                    </span>
                  </div>
                  <p className="text-sm text-lingo-text-light truncate">
                    {unit.description}
                  </p>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1 text-xs text-lingo-text-light">
                    <span>{getLanguageName(unit.targetLanguage)}</span>
                    {unit.level && (
                      <>
                        <span>·</span>
                        <span>{unit.level}</span>
                      </>
                    )}
                    <span>·</span>
                    <span>
                      {unit.lessonCount}{" "}
                      {unit.lessonCount === 1 ? "lesson" : "lessons"}
                    </span>
                    {unit.creatorName && (
                      <>
                        <span>·</span>
                        <span className="truncate">by {unit.creatorName}</span>
                      </>
                    )}
                  </div>
                  {/* Progress bar */}
                  <div className="flex items-center gap-2 mt-2">
                    <div className="h-2 flex-1 rounded-full bg-lingo-gray overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{
                          width: `${progress}%`,
                          backgroundColor: color,
                        }}
                      />
                    </div>
                    <span
                      className="text-xs font-bold whitespace-nowrap"
                      style={{ color }}
                    >
                      {unit.completedLessons}/{unit.lessonCount}
                    </span>
                  </div>
                </div>
              </Link>
              {unit.isOwner && (
                <div className="border-t border-lingo-border px-4 py-2">
                  <Link
                    href={`/units/edit/${unit.id}`}
                    className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-bold text-lingo-blue hover:bg-lingo-blue/10 transition-colors"
                  >
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
                        d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0115.75 21H5.25A2.25 2.25 0 013 18.75V8.25A2.25 2.25 0 015.25 6H10"
                      />
                    </svg>
                    Edit Markdown
                  </Link>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
