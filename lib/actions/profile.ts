"use server";

import { db } from "@/lib/db";
import {
  userStats,
  userAchievement,
  achievementDefinition,
  lessonCompletion,
} from "@/lib/db/schema";
import { eq, and, desc } from "drizzle-orm";
import { requireSession } from "@/lib/auth-server";
import { revalidatePath } from "next/cache";

export async function getProfileData() {
  const session = await requireSession();
  const userId = session.user.id;

  const [stats] = await db
    .select()
    .from(userStats)
    .where(eq(userStats.userId, userId));

  const achievements = await db
    .select({
      id: achievementDefinition.id,
      title: achievementDefinition.title,
      description: achievementDefinition.description,
      icon: achievementDefinition.icon,
      category: achievementDefinition.category,
      unlockedAt: userAchievement.unlockedAt,
    })
    .from(achievementDefinition)
    .leftJoin(
      userAchievement,
      and(
        eq(userAchievement.achievementId, achievementDefinition.id),
        eq(userAchievement.userId, userId)
      )
    );

  const recentCompletions = await db
    .select()
    .from(lessonCompletion)
    .where(eq(lessonCompletion.userId, userId))
    .orderBy(desc(lessonCompletion.completedAt))
    .limit(10);

  return {
    user: session.user,
    stats: stats ?? {
      xp: 0,
      level: 1,
      hearts: 5,
      maxHearts: 5,
      currentStreak: 0,
      longestStreak: 0,
      totalLessonsCompleted: 0,
      nativeLanguage: null as string | null,
    },
    achievements: achievements.map((a) => ({
      ...a,
      unlocked: !!a.unlockedAt,
    })),
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

  revalidatePath("/learn");
  revalidatePath("/profile");
}

export async function getNativeLanguage(userId: string): Promise<string | null> {
  const [stats] = await db
    .select({ nativeLanguage: userStats.nativeLanguage })
    .from(userStats)
    .where(eq(userStats.userId, userId));

  return stats?.nativeLanguage ?? null;
}
