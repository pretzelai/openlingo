export type PromptDefinition = {
  id: string;
  displayName: string;
  description: string;
  defaultTemplate: string;
  variables: string[];
};

export const langCodeToName: Record<string, string> = {
  de: "German",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  pt: "Portuguese",
  ru: "Russian",
  ar: "Arabic",
  hi: "Hindi",
  ko: "Korean",
  zh: "Mandarin Chinese",
  ja: "Japanese",
  en: "English",
  tr: "Turkish",
  pl: "Polish",
};

export const PROMPT_DEFINITIONS: PromptDefinition[] = [
  {
    id: "word-analysis",
    displayName: "Word Analysis",
    description: "Used when looking up unknown words via AI",
    defaultTemplate: `Analyze the {langName} word "{word}".

If this is an inflected/conjugated form, identify the base/dictionary form.

Return the base form, English translation, part of speech, grammatical gender (or null), CEFR level, an example sentence in {langName}, and its English translation.`,
    variables: ["langName", "word"],
  },
  {
    id: "review-ai",
    displayName: "Review AI",
    description: "AI hint shown during flashcard review sessions",
    defaultTemplate: `Give me a helpful mnemonic or usage example for the {language} word "{word}" (meaning: {translation}).`,
    variables: [
      "word",
      "language",
      "translation",
      "ease_factor",
      "interval",
      "repetitions",
      "next_review_at",
      "last_reviewed_at",
      "created_at",
    ],
  },
  {
    id: "unit-generation",
    displayName: "Unit Generation",
    description: "Prompt for generating lesson units via CLI script",
    defaultTemplate: `You are a curriculum designer for a Duolingo-style German learning app. The learners are English speakers learning B1 level German.

Generate a complete unit that teaches German vocabulary and grammar through the topic: "{topic}"

The unit must have exactly {lessons} lessons (sections). Each lesson teaches 4-6 new German words/phrases related to the topic.

Do not ask questions that requiere knowledge about the topic like when was someone born or when did something happen. The questions should be about the vocabulary and grammar of the lesson.

Output a single markdown file in EXACTLY this format (no deviations):

The first matching pairs exercise should introduce the 4-6 new German words/phrases of B1 level. The rest of the words in the lesson should be A1/A2 level.

---
title: "<Unit Title in German>"
description: "<1-line English description of what this unit teaches>"
order: 99
icon: "<single emoji>"
color: "<hex color>"
---

## <Lesson 1 Title in German>

[matching-pairs]
- "<German word 1>" = "<English meaning 1>"
- "<German word 2>" = "<English meaning 2>"
- "<German word 3>" = "<English meaning 3>"
- "<German word 4>" = "<English meaning 4>"

---

[multiple-choice]
prompt: "<question about a German word/phrase>"
choices:
  - "<correct answer>" (correct)
  - "<wrong answer>"
  - "<wrong answer>"

---

[multiple-choice]
prompt: "<question about another German word/phrase>"
choices:
  - "<correct answer>" (correct)
  - "<wrong answer>"
  - "<wrong answer>"

---

[word-bank]
prompt: "<Sentence in English>"
words: ["<word1>", "<word2>", "<word3>", "<word4>", "<word5>", "<distractor>"]
answer: ["<word1>", "<word2>", "<word3>", "<word4>", "<word5>"]

---

[listening]
text: "<A German sentence using vocabulary from this lesson>"
ttsLang: "de"
mode: word-bank

## <Lesson 2 Title in German>

... (same pattern)`,
    variables: ["topic", "lessons"],
  },
  {
    id: "tts-instructions",
    displayName: "TTS Voice",
    description: "Instructions sent to the text-to-speech model",
    defaultTemplate: `Speak in {language_name} with clear, native pronunciation. Calm, measured pace for learners.`,
    variables: ["language_name"],
  },
];

export const PROMPTS_BY_ID: Record<string, PromptDefinition> = Object.fromEntries(
  PROMPT_DEFINITIONS.map((p) => [p.id, p])
);

export function getDefaultTemplate(id: string): string {
  const def = PROMPTS_BY_ID[id];
  if (!def) throw new Error(`Unknown prompt ID: ${id}`);
  return def.defaultTemplate;
}

export function interpolateTemplate(
  template: string,
  vars: Record<string, string>
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return key in vars ? vars[key] : match;
  });
}
