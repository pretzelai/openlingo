"use server";

import { db } from "@/lib/db";
import { userPreferences } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { requireSession } from "@/lib/auth-server";
import { revalidatePath } from "next/cache";
import { supportedLanguages } from "@/lib/languages";

export async function getTargetLanguage(userId?: string): Promise<string> {
  const uid = userId ?? (await requireSession()).user.id;

  const [row] = await db
    .select({ targetLanguage: userPreferences.targetLanguage })
    .from(userPreferences)
    .where(eq(userPreferences.userId, uid))
    .limit(1);

  return row?.targetLanguage ?? "de";
}

export async function updateTargetLanguage(language: string) {
  const session = await requireSession();
  const userId = session.user.id;

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

  revalidatePath("/");
}
