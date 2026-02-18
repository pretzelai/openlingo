"use client";

import { useTransition } from "react";
import { PromptEditor } from "./prompt-editor";
import { MemoryEditor } from "./memory-editor";
import type { PromptWithOverride } from "@/lib/actions/prompts";
import { updateTargetLanguage } from "@/lib/actions/preferences";
import { updateNativeLanguage } from "@/lib/actions/profile";
import { supportedLanguages, getLanguageName } from "@/lib/languages";

const TARGET_LANGUAGES = Object.keys(supportedLanguages).filter((k) => k !== "en");

const NATIVE_LANGUAGES = [
  "en", "es", "fr", "de", "pt", "it", "nl", "ru", "zh", "ja", "ko", "ar",
  "hi", "tr", "pl", "sv", "da", "no", "fi", "cs", "ro", "hu", "el", "he",
  "th", "vi", "id", "ms", "uk", "bg",
];

export function PromptsView({
  prompts,
  initialMemory,
  targetLanguage,
  nativeLanguage,
}: {
  prompts: PromptWithOverride[];
  initialMemory: string;
  targetLanguage: string;
  nativeLanguage: string | null;
}) {
  const [savingTarget, startSaveTarget] = useTransition();
  const [savingNative, startSaveNative] = useTransition();

  return (
    <div className="mx-auto max-w-2xl py-6">
      <h1 className="text-2xl font-black text-lingo-text mb-1">AI Prompts</h1>
      <p className="text-sm text-lingo-text-light font-bold mb-6">
        Customize the prompts used by AI features throughout the app.
      </p>

      {/* Language settings */}
      <div className="rounded-2xl border-2 border-lingo-border bg-white p-5 mb-6 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-lingo-text-light">Learning Language</span>
          <select
            value={targetLanguage}
            disabled={savingTarget}
            onChange={(e) => {
              const value = e.target.value;
              if (!value) return;
              startSaveTarget(() => updateTargetLanguage(value));
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
        <div className="flex items-center justify-between">
          <span className="text-sm font-bold text-lingo-text-light">Native Language</span>
          <select
            value={nativeLanguage ?? ""}
            disabled={savingNative}
            onChange={(e) => {
              const value = e.target.value;
              if (!value) return;
              startSaveNative(() => updateNativeLanguage(value));
            }}
            className="rounded-lg border-2 border-lingo-border bg-lingo-card px-3 py-1.5 text-sm font-bold text-lingo-text disabled:opacity-50"
          >
            <option value="">Select language</option>
            {NATIVE_LANGUAGES.map((code) => (
              <option key={code} value={code}>
                {getLanguageName(code)}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-4">
        <MemoryEditor initialValue={initialMemory} />

        {prompts.map((p) => (
          <PromptEditor key={p.id} prompt={p} />
        ))}
      </div>
    </div>
  );
}
