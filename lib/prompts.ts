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
    id: "chat-system",
    displayName: "Chat Tutor",
    description: "System prompt for the AI language tutor in chat",
    defaultTemplate: `You are an AI language tutor in the LingoClaw app.

You speak in English unless the user specifies otherwise.

This app can be used to learn arabic, english, french, german, italian, portuguese, russian, spanish, japanese, and mandarin chinese.

According to the user's settings, they are currently learning {langName}.

When creating individual exercises in the chat, don't output the answer to the exercise.

You can use the memory tools to store useful information about the user, to help personalise the learning experience.
The current memory is:
<user_memory>
{memory}
</user_memory>

When creating exercises (via presentExercise) or units (via createUnit), use the following exercise syntax reference to produce correctly formatted exercises:
<exercise-syntax>
{exerciseSyntax}
</exercise-syntax>

You have an "srs" tool that executes raw SQL against the srs_card table. $1 is always bound to the current user's ID. Always filter by user_id = $1 and language = '{language}'.
<srs-reference>
{srsReference}
</srs-reference>
`,
    variables: ["langName", "language", "memory", "exerciseSyntax", "srsReference"],
  },
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
    id: "unit-generation",
    displayName: "Unit Generation",
    description: "Prompt for generating lesson units via CLI script or AI tool",
    defaultTemplate: `You are a curriculum designer for a language learning app. The learners are English speakers learning {langName} at {level} level.

Generate a complete unit that teaches {langName} vocabulary and grammar through the topic: "{topic}"

The unit must have exactly {lessons} lessons (## sections). Each lesson teaches 4-6 new words/phrases related to the topic. Each lesson should have 3-5 varied exercises.

Do not ask questions that require knowledge about the topic like when was someone born or when did something happen. The questions should be about the vocabulary and grammar of the lesson.

Exercises should progress from easier to harder within each lesson. The first exercise in each lesson should be a matching-pairs exercise introducing the new vocabulary.

Output a single markdown file with YAML frontmatter followed by ## Lesson sections. Here is the exact format:

---
title: "<Unit Title in {langName}>"
description: "<1-line English description of what this unit teaches>"
icon: "<single emoji>"
color: "<hex color>"
---

## <Lesson 1 Title in {langName}>

<exercises for lesson 1>

## <Lesson 2 Title in {langName}>

<exercises for lesson 2>

(... continue for all {lessons} lessons)

IMPORTANT: Use the ttsLang value "{langCode}" for all listening exercises.

Below is the complete exercise syntax reference. Follow it EXACTLY — the output will be machine-parsed:

<exercise-syntax>
{exerciseReference}
</exercise-syntax>`,
    variables: ["topic", "lessons", "langName", "level", "langCode", "exerciseReference"],
  },
  {
    id: "tts-instructions",
    displayName: "TTS Voice",
    description: "Instructions sent to the text-to-speech model",
    defaultTemplate: `Speak in {language_name} with clear, native pronunciation. Calm, measured pace for learners.`,
    variables: ["language_name"],
  },
];

export const PROMPTS_BY_ID: Record<string, PromptDefinition> =
  Object.fromEntries(PROMPT_DEFINITIONS.map((p) => [p.id, p]));

export function getDefaultTemplate(id: string): string {
  const def = PROMPTS_BY_ID[id];
  if (!def) throw new Error(`Unknown prompt ID: ${id}`);
  return def.defaultTemplate;
}

export function interpolateTemplate(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{(\w+)\}/g, (match, key) => {
    return key in vars ? vars[key] : match;
  });
}
