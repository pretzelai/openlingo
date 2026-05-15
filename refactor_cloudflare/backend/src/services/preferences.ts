import { eq } from "drizzle-orm";
import type { Database } from "../types";
import { userPreferences } from "../lib/db/schema";
import { supportedLanguages } from "../../../../lib/languages";
import { DEFAULT_AI_MODEL } from "../../../../lib/constants";
import { getModelsForUser } from "../../../../lib/ai/models";

export async function getTargetLanguage(db: Database, userId: string): Promise<string | null> {
  const [row] = await db
    .select({ targetLanguage: userPreferences.targetLanguage })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  return row?.targetLanguage ?? null;
}

export async function updateTargetLanguage(db: Database, userId: string, language: string) {
  if (!supportedLanguages[language]) {
    throw new Error(`Unsupported language: ${language}`);
  }

  await db
    .insert(userPreferences)
    .values({ userId, targetLanguage: language })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { targetLanguage: language, updatedAt: new Date() },
    });
}

export async function getPreferredModel(db: Database, userId: string): Promise<string> {
  const [row] = await db
    .select({ preferredModel: userPreferences.preferredModel })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  return row?.preferredModel ?? DEFAULT_AI_MODEL;
}

export async function updatePreferredModel(
  db: Database,
  userId: string,
  email: string | null | undefined,
  model: string,
) {
  const userModels = getModelsForUser(email);
  const valid = userModels.some((entry) => entry.id === model);

  if (!valid) {
    throw new Error(`Unsupported model: ${model}`);
  }

  await db
    .insert(userPreferences)
    .values({ userId, preferredModel: model })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { preferredModel: model, updatedAt: new Date() },
    });
}
