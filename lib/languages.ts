const displayNames = new Intl.DisplayNames(["en"], { type: "language" });

export function getLanguageName(code: string): string {
  return displayNames.of(code) ?? code;
}

/** Maps ISO 639-1 language codes to emoji flags (most associated country). */
const languageFlags: Record<string, string> = {
  en: "\u{1F1EC}\u{1F1E7}", // 🇬🇧
  es: "\u{1F1EA}\u{1F1F8}", // 🇪🇸
  fr: "\u{1F1EB}\u{1F1F7}", // 🇫🇷
  de: "\u{1F1E9}\u{1F1EA}", // 🇩🇪
  pt: "\u{1F1E7}\u{1F1F7}", // 🇧🇷
  it: "\u{1F1EE}\u{1F1F9}", // 🇮🇹
  nl: "\u{1F1F3}\u{1F1F1}", // 🇳🇱
  ru: "\u{1F1F7}\u{1F1FA}", // 🇷🇺
  zh: "\u{1F1E8}\u{1F1F3}", // 🇨🇳
  ja: "\u{1F1EF}\u{1F1F5}", // 🇯🇵
  ko: "\u{1F1F0}\u{1F1F7}", // 🇰🇷
  ar: "\u{1F1F8}\u{1F1E6}", // 🇸🇦
  hi: "\u{1F1EE}\u{1F1F3}", // 🇮🇳
  tr: "\u{1F1F9}\u{1F1F7}", // 🇹🇷
  pl: "\u{1F1F5}\u{1F1F1}", // 🇵🇱
  sv: "\u{1F1F8}\u{1F1EA}", // 🇸🇪
  da: "\u{1F1E9}\u{1F1F0}", // 🇩🇰
  no: "\u{1F1F3}\u{1F1F4}", // 🇳🇴
  fi: "\u{1F1EB}\u{1F1EE}", // 🇫🇮
  cs: "\u{1F1E8}\u{1F1FF}", // 🇨🇿
  ro: "\u{1F1F7}\u{1F1F4}", // 🇷🇴
  hu: "\u{1F1ED}\u{1F1FA}", // 🇭🇺
  el: "\u{1F1EC}\u{1F1F7}", // 🇬🇷
  he: "\u{1F1EE}\u{1F1F1}", // 🇮🇱
  th: "\u{1F1F9}\u{1F1ED}", // 🇹🇭
  vi: "\u{1F1FB}\u{1F1F3}", // 🇻🇳
  id: "\u{1F1EE}\u{1F1E9}", // 🇮🇩
  ms: "\u{1F1F2}\u{1F1FE}", // 🇲🇾
  uk: "\u{1F1FA}\u{1F1E6}", // 🇺🇦
  bg: "\u{1F1E7}\u{1F1EC}", // 🇧🇬
};

export function getLanguageFlag(code: string): string {
  return languageFlags[code] ?? "";
}

/** Language codes that have dictionary data available. */
export const supportedLanguages: Record<string, string> = {
  en: "english",
  es: "spanish",
  de: "german",
  fr: "french",
  it: "italian",
  pt: "portuguese",
  ru: "russian",
  ar: "arabic",
  hi: "hindi",
  ko: "korean",
  zh: "mandarin",
  ja: "japanese-hiragana",
};
