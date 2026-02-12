"use client";

import { useTransition } from "react";
import { updateNativeLanguage } from "@/lib/actions/profile";
import { getLanguageName } from "@/lib/languages";

const COMMON_LANGUAGES = [
  "en", "es", "fr", "de", "pt", "it", "nl", "ru", "zh", "ja", "ko", "ar",
  "hi", "tr", "pl", "sv", "da", "no", "fi", "cs", "ro", "hu", "el", "he",
  "th", "vi", "id", "ms", "uk", "bg",
];

interface NativeLanguagePickerProps {
  currentLanguage: string | null;
}

export function NativeLanguagePicker({
  currentLanguage,
}: NativeLanguagePickerProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-lingo-text-light">Native Language</span>
      </div>
      <select
        value={currentLanguage ?? ""}
        disabled={isPending}
        onChange={(e) => {
          const value = e.target.value;
          if (!value) return;
          startTransition(() => updateNativeLanguage(value));
        }}
        className="rounded-lg border-2 border-lingo-border bg-lingo-card px-3 py-1.5 text-sm font-bold text-lingo-text disabled:opacity-50"
      >
        <option value="">Select language</option>
        {COMMON_LANGUAGES.map((code) => (
          <option key={code} value={code}>
            {getLanguageName(code)}
          </option>
        ))}
      </select>
    </div>
  );
}
