"use client";

import { useTransition } from "react";
import { updateTargetLanguage } from "@/lib/actions/preferences";
import { supportedLanguages, getLanguageName } from "@/lib/languages";

const TARGET_LANGUAGES = Object.keys(supportedLanguages).filter((k) => k !== "en");

interface TargetLanguagePickerProps {
  currentLanguage: string;
}

export function TargetLanguagePicker({
  currentLanguage,
}: TargetLanguagePickerProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-lingo-text-light">Learning Language</span>
      </div>
      <select
        value={currentLanguage}
        disabled={isPending}
        onChange={(e) => {
          const value = e.target.value;
          if (!value) return;
          startTransition(() => updateTargetLanguage(value));
        }}
        className="rounded-lg border-2 border-lingo-border bg-lingo-card px-3 py-1.5 text-sm font-bold text-lingo-text disabled:opacity-50"
      >
        {TARGET_LANGUAGES.map((code) => (
          <option key={code} value={code}>
            {getLanguageName(code)}
          </option>
        ))}
      </select>
    </div>
  );
}
