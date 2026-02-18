import { createProviderRegistry } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";

const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_AI_API_KEY,
});

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = createAnthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const registry = createProviderRegistry({ google, openai, anthropic });

export const AVAILABLE_MODELS: {
  id: string;
  label: string;
  provider: string;
}[] = [
  { id: "gemini-3-flash-preview", label: "Gemini 3 Flash", provider: "google" },
  { id: "gemini-3-pro-preview", label: "Gemini 3 Pro", provider: "google" },
  {
    id: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash Lite",
    provider: "google",
  },
  { id: "gpt-4o", label: "GPT-4o", provider: "openai" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "openai" },
  {
    id: "claude-sonnet-4-6",
    label: "Claude Sonnet 4.6",
    provider: "anthropic",
  },
  { id: "claude-opus-4-6", label: "Claude Opus 4.6", provider: "anthropic" },
];

export function getModel(id: string) {
  const resolved =
    AVAILABLE_MODELS.find((m) => m.id === id)?.provider + ":" + id;
  return registry.languageModel(
    resolved as Parameters<typeof registry.languageModel>[0],
  );
}
