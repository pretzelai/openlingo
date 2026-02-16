import { createProviderRegistry } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { db } from "@/lib/db";
import { userPreferences } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

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
  "claude-haiku-4-5-20251001": "anthropic:claude-haiku-4-5-20251001",
  "claude-sonnet-4-5-20250929": "anthropic:claude-sonnet-4-5-20250929",
  "claude-opus-4-6": "anthropic:claude-opus-4-6",
};

export const AVAILABLE_MODELS: { id: string; label: string }[] = [
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "gpt-4o", label: "GPT-4o" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" },
  { id: "claude-sonnet-4-5-20250929", label: "Claude Sonnet 4.5" },
  { id: "claude-opus-4-6", label: "Claude Opus 4.6" },
];

const DEFAULT_MODEL = "gemini-2.5-flash";

export function getModel(name: string) {
  const resolved = MODEL_ALIASES[name] ?? name;
  return registry.languageModel(
    resolved as Parameters<typeof registry.languageModel>[0]
  );
}

export async function getUserModel(userId: string) {
  const [row] = await db
    .select({ preferredModel: userPreferences.preferredModel })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  return getModel(row?.preferredModel ?? DEFAULT_MODEL);
}
