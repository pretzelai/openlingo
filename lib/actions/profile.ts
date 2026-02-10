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
    },
    achievements: achievements.map((a) => ({
      ...a,
      unlocked: !!a.unlockedAt,
    })),
    recentCompletions,
  };
}
