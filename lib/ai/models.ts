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

const MODEL_ALIASES: Record<string, string> = {
  "gemini-3-flash-preview": "google:gemini-3-flash-preview",
  "gemini-3-pro": "google:gemini-3-pro-preview",
  "gpt-4o": "openai:gpt-4o",
  "gpt-4o-mini": "openai:gpt-4o-mini",
  "claude-sonnet-4-5-20250929": "anthropic:claude-sonnet-4-5-20250929",
  "claude-opus-4-6": "anthropic:claude-opus-4-6",
};

export const AVAILABLE_MODELS: { id: string; label: string }[] = [
  { id: "gemini-3-flash-preview", label: "Gemini 3 Flash" },
  { id: "gemini-3-pro-preview", label: "Gemini 3 Pro" },
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5" },
  { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
];

export function getModel(name: string) {
  const resolved = MODEL_ALIASES[name] ?? name;
  return registry.languageModel(
    resolved as Parameters<typeof registry.languageModel>[0],
  );
}
