import { createProviderRegistry } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

const google = createGoogleGenerativeAI({ apiKey: process.env.GOOGLE_AI_API_KEY });
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const anthropic = createAnthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

type CustomModelDef = { id: string; label: string; chat?: boolean };

const CUSTOM_PROVIDER_NAME = process.env.CUSTOM_PROVIDER_NAME || "custom";
const CUSTOM_BASE_URL = process.env.CUSTOM_PROVIDER_BASE_URL;

let customModels: CustomModelDef[] = [];
let customProvider: ReturnType<typeof createOpenAICompatible> | undefined;

if (CUSTOM_BASE_URL) {
  try {
    const rawModels = process.env.CUSTOM_PROVIDER_MODELS || "[]";
    customModels = JSON.parse(rawModels.trim());
  } catch (e) {
    console.error("[AI] Error parsing CUSTOM_PROVIDER_MODELS:", e);
    customModels = [];
  }

  try {
    customProvider = createOpenAICompatible({
      name: CUSTOM_PROVIDER_NAME,
      apiKey: (process.env.CUSTOM_PROVIDER_API_KEY || "").trim(),
      baseURL: CUSTOM_BASE_URL.trim(),
    });
  } catch (e) {
    console.error("[AI] Error creating custom provider:", e);
  }
}

const registry = createProviderRegistry({
  google,
  openai,
  anthropic,
  ...(customProvider ? { [CUSTOM_PROVIDER_NAME]: customProvider } : {}),
});

const STATIC_MODELS = [
  { id: "gemini-3-flash-preview", label: "Gemini 3 Flash", provider: "google" },
  { id: "gemini-3-pro-preview", label: "Gemini 3 Pro", provider: "google" },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", provider: "google" },
  { id: "gpt-4o", label: "GPT-4o", provider: "openai" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "openai" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "anthropic" },
  { id: "claude-opus-4-6", label: "Claude Opus 4.6", provider: "anthropic" },
];

export const AVAILABLE_MODELS: { id: string; label: string; provider: string }[] = [
  ...STATIC_MODELS,
  ...customModels.map((m) => ({
    id: m.id,
    label: m.label,
    provider: CUSTOM_PROVIDER_NAME
  })),
];

/** Models available to regular (non-admin) users in the chat UI. */
export const CHAT_AVAILABLE_MODELS = AVAILABLE_MODELS.filter(
  (m) =>
    m.id === "claude-sonnet-4-6" ||
    customModels.some((cm) => cm.id === m.id && cm.chat === true),
);

/** Comma-separated list of admin emails loaded from env. */
const ADMIN_EMAILS: string[] = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

/** Returns the model list appropriate for the given user email. */
export function getModelsForUser(email: string | null | undefined) {
  const models = isAdminEmail(email) ? AVAILABLE_MODELS : CHAT_AVAILABLE_MODELS;
  // Final safety: ensure we always return at least Claude or whatever is static if custom fails
  return models.length > 0 ? models : STATIC_MODELS.filter(m => m.id === "claude-sonnet-4-6");
}

export function getModel(id: string) {
  const model = AVAILABLE_MODELS.find((m) => m.id === id);
  // Fallback to provider "anthropic" if model is not found, or use the provider from the found model
  const provider = model?.provider || "anthropic";
  const resolved = `${provider}:${id}`;

  return registry.languageModel(
    resolved as Parameters<typeof registry.languageModel>[0],
  );
}
