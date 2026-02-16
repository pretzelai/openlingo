const displayNames = new Intl.DisplayNames(["en"], { type: "language" });

export function getLanguageName(code: string): string {
  return displayNames.of(code) ?? code;
}

/** Language codes that have dictionary data available. */
export const supportedLanguages: Record<string, string> = {
  de: "german",
  fr: "french",
  es: "spanish",
  it: "italian",
  pt: "portuguese",
  ru: "russian",
  ar: "arabic",
  hi: "hindi",
  ko: "korean",
  zh: "mandarin",
  ja: "japanese-hiragana",
  en: "english",
};
