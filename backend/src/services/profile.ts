import { desc, eq } from "drizzle-orm";
import type { Database } from "../types";
import {
  lessonCompletion,
  userPreferences,
  userStats,
} from "../lib/db/schema";

export async function getProfileData(db: Database, userId: string, user: { id: string; email: string; name: string }) {
  const [stats] = await db.select().from(userStats).where(eq(userStats.userId, userId));

  const recentCompletions = await db
    .select()
    .from(lessonCompletion)
    .where(eq(lessonCompletion.userId, userId))
    .orderBy(desc(lessonCompletion.completedAt))
    .limit(10);

  return {
    user,
    stats: stats ?? {
      currentStreak: 0,
      longestStreak: 0,
      totalLessonsCompleted: 0,
    },
    recentCompletions,
  };
}

export async function updateNativeLanguage(db: Database, userId: string, language: string) {
  await db
    .insert(userPreferences)
    .values({ userId, nativeLanguage: language, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { nativeLanguage: language, updatedAt: new Date() },
    });
}

export async function getNativeLanguage(db: Database, userId: string): Promise<string | null> {
  const [prefs] = await db
    .select({ nativeLanguage: userPreferences.nativeLanguage })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId));

  return prefs?.nativeLanguage ?? null;
}
