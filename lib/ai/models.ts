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
  "gemini-2.5-flash-lite": "google:gemini-2.5-flash-lite",
  "gemini-2.5-flash": "google:gemini-2.5-flash",
  "gemini-2.5-pro": "google:gemini-2.5-pro",
  "gpt-4o": "openai:gpt-4o",
  "gpt-4o-mini": "openai:gpt-4o-mini",
  "claude-sonnet-4-5-20250929": "anthropic:claude-sonnet-4-5-20250929",
};

export function getModel(name: string) {
  const resolved = MODEL_ALIASES[name] ?? name;
  return registry.languageModel(
    resolved as Parameters<typeof registry.languageModel>[0]
  );
}
