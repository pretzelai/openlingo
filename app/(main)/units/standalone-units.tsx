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
      <div className="grid gap-3">
        {units.map((unit, i) => {
          const color = getUnitColor(i);
          return (
            <Link
              key={unit.id}
              href={`/unit/${unit.id}`}
              className="flex items-center gap-4 rounded-xl border-2 border-lingo-border bg-white p-4 shadow-[0_2px_0_0] shadow-lingo-border transition-all hover:border-lingo-green hover:bg-lingo-green/5 active:translate-y-[1px] active:shadow-none"
            >
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
                style={{ backgroundColor: `${color}20` }}
              >
                {unit.icon}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-lingo-text truncate">
                  {unit.title}
                </p>
                <p className="text-sm text-lingo-text-light truncate">
                  {unit.description}
                </p>
                <div className="flex items-center gap-2 mt-1 text-xs text-lingo-text-light">
                  <span>{getLanguageName(unit.targetLanguage)}</span>
                  {unit.level && (
                    <>
                      <span>·</span>
                      <span>{unit.level}</span>
                    </>
                  )}
                  <span>·</span>
                  <span>
                    {unit.lessonCount} {unit.lessonCount === 1 ? "lesson" : "lessons"}
                  </span>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
