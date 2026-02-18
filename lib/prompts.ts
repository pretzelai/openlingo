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

Exercises add/update SRS cards internally, do not add/update them manually before/after exercises.

You have an "srs" tool that executes raw SQL against the srs_card table. $1 is always bound to the current user's ID. Always filter by user_id = $1 and language = '{language}'.
<srs-reference>
{srsReference}
</srs-reference>
`,
    variables: [
      "langName",
      "language",
      "memory",
      "exerciseSyntax",
      "srsReference",
    ],
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
