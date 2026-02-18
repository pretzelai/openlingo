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

import { CHAT_SYSTEM_PROMPT } from "./chat-system";

export const PROMPT_DEFINITIONS: PromptDefinition[] = [
  CHAT_SYSTEM_PROMPT,
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
