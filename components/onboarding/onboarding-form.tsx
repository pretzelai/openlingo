"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { updateTargetLanguage } from "@/lib/actions/preferences";
import { updateNativeLanguage } from "@/lib/actions/profile";
import {
  supportedLanguages,
  getLanguageName,
  getLanguageFlag,
} from "@/lib/languages";
import { DEFAULT_PATH } from "@/lib/constants";

const TARGET_LANGUAGES = Object.keys(supportedLanguages);

const NATIVE_LANGUAGES = [
  "en",
  "es",
  "fr",
  "de",
  "pt",
  "it",
  "nl",
  "ru",
  "zh",
  "ja",
  "ko",
  "ar",
  "hi",
  "tr",
  "pl",
  "sv",
  "da",
  "no",
  "fi",
  "cs",
  "ro",
  "hu",
  "el",
  "he",
  "th",
  "vi",
  "id",
  "ms",
  "uk",
  "bg",
];

export function OnboardingForm({
  nativeLanguage,
}: {
  nativeLanguage: string | null;
}) {
  const router = useRouter();
  const [target, setTarget] = useState("");
  const [native, setNative] = useState(nativeLanguage ?? "en");
  const [error, setError] = useState("");
  const [saving, startSave] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!target) {
      setError("Please select a language to learn.");
      return;
    }
    if (!native) {
      setError("Please select your native language.");
      return;
    }
    if (target === native) {
      setError("Your learning language and native language must be different.");
      return;
    }

    startSave(async () => {
      await Promise.all([
        updateTargetLanguage(target),
        updateNativeLanguage(native),
      ]);
      router.push(DEFAULT_PATH);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="space-y-2">
        <label className="block text-sm font-bold text-lingo-text-light">
          I want to learn
        </label>
        <select
          value={target}
          onChange={(e) => setTarget(e.target.value)}
          className="w-full rounded-xl border-2 border-lingo-border bg-white px-4 py-4 text-lg font-bold text-lingo-text focus:border-lingo-green focus:outline-none transition-colors"
        >
          <option value="" disabled>Select a language</option>
          {TARGET_LANGUAGES.map((code) => (
            <option key={code} value={code}>
              {getLanguageFlag(code)} {getLanguageName(code)}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        <label className="block text-sm font-bold text-lingo-text-light">
          I speak (native language)
        </label>
        <select
          value={native}
          onChange={(e) => setNative(e.target.value)}
          className="w-full rounded-xl border-2 border-lingo-border bg-white px-4 py-4 text-lg font-bold text-lingo-text focus:border-lingo-green focus:outline-none transition-colors"
        >
          <option value="" disabled>Select your language</option>
          {NATIVE_LANGUAGES.map((code) => (
            <option key={code} value={code}>
              {getLanguageFlag(code)} {getLanguageName(code)}
            </option>
          ))}
        </select>
      </div>

      {error && <p className="text-sm text-lingo-red font-medium">{error}</p>}

      <Button type="submit" size="lg" loading={saving} className="w-full">
        Get Started
      </Button>
    </form>
  );
}
