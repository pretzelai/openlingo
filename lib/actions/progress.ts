"use server";

import { db } from "@/lib/db";
import { userCourseEnrollment, userStats, lessonCompletion } from "@/lib/db/schema";
import { eq, and } from "drizzle-orm";
import { requireSession } from "@/lib/auth-server";

export async function getUserProgress(courseId: string) {
  const session = await requireSession();
  const userId = session.user.id;

  const [enrollment] = await db
    .select()
    .from(userCourseEnrollment)
    .where(
      and(
        eq(userCourseEnrollment.userId, userId),
        eq(userCourseEnrollment.courseId, courseId)
      )
    );

  const completions = await db
    .select()
    .from(lessonCompletion)
    .where(
      and(
        eq(lessonCompletion.userId, userId),
        eq(lessonCompletion.courseId, courseId)
      )
    );

  return { enrollment, completions };
}

export async function enrollInCourse(courseId: string) {
  const session = await requireSession();
  const userId = session.user.id;

  // Check if already enrolled
  const [existing] = await db
    .select()
    .from(userCourseEnrollment)
    .where(
      and(
        eq(userCourseEnrollment.userId, userId),
        eq(userCourseEnrollment.courseId, courseId)
      )
    );

  if (existing) return existing;

  // Create enrollment
  const [enrollment] = await db
    .insert(userCourseEnrollment)
    .values({ userId, courseId })
    .returning();

  // Create user stats if not exist
  const [stats] = await db
    .select()
    .from(userStats)
    .where(eq(userStats.userId, userId));

  if (!stats) {
    await db.insert(userStats).values({ userId });
  }

  return enrollment;
}

export async function getUserStatsData() {
  const session = await requireSession();
  const userId = session.user.id;

  const [stats] = await db
    .select()
    .from(userStats)
    .where(eq(userStats.userId, userId));

  if (!stats) {
    const [newStats] = await db
      .insert(userStats)
      .values({ userId })
      .returning();
    return newStats;
  }

  // Compute heart regeneration
  const now = new Date();
  const lastRegen = new Date(stats.heartsLastRegenAt);
  const minutesPassed = Math.floor((now.getTime() - lastRegen.getTime()) / (1000 * 60));
  const heartsToRegen = Math.floor(minutesPassed / 30);

  if (heartsToRegen > 0 && stats.hearts < stats.maxHearts) {
    const newHearts = Math.min(stats.maxHearts, stats.hearts + heartsToRegen);
    const [updated] = await db
      .update(userStats)
      .set({ hearts: newHearts, heartsLastRegenAt: now })
      .where(eq(userStats.userId, userId))
      .returning();
    return updated;
  }

  return stats;
}
