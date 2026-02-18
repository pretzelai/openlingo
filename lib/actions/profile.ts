"use server";

import { db } from "@/lib/db";
import {
  userStats,
  lessonCompletion,
} from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";
import { requireSession } from "@/lib/auth-server";
import { revalidatePath } from "next/cache";
import { DEFAULT_PATH } from "../constants";

export async function getProfileData() {
  const session = await requireSession();
  const userId = session.user.id;

  const [stats] = await db
    .select()
    .from(userStats)
    .where(eq(userStats.userId, userId));

  const recentCompletions = await db
    .select()
    .from(lessonCompletion)
    .where(eq(lessonCompletion.userId, userId))
    .orderBy(desc(lessonCompletion.completedAt))
    .limit(10);

  return {
    user: session.user,
    stats: stats ?? {
      currentStreak: 0,
      longestStreak: 0,
      totalLessonsCompleted: 0,
      nativeLanguage: null as string | null,
    },
    recentCompletions,
  };
}

export async function updateNativeLanguage(language: string) {
  const session = await requireSession();
  const userId = session.user.id;

  const [existing] = await db
    .select()
    .from(userStats)
    .where(eq(userStats.userId, userId));

  if (existing) {
    await db
      .update(userStats)
      .set({ nativeLanguage: language })
      .where(eq(userStats.userId, userId));
  } else {
    await db.insert(userStats).values({ userId, nativeLanguage: language });
  }

  revalidatePath(DEFAULT_PATH);
  revalidatePath("/prompts");
}

export async function getNativeLanguage(userId: string): Promise<string | null> {
  const [stats] = await db
    .select({ nativeLanguage: userStats.nativeLanguage })
    .from(userStats)
    .where(eq(userStats.userId, userId));

  return stats?.nativeLanguage ?? null;
}
