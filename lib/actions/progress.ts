"use server";

import { db } from "@/lib/db";
import { userCourseEnrollment, userStats, lessonCompletion, unit } from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
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

  // Get completions via unit join (lessonCompletion now references unitId)
  const courseUnitIds = await db
    .select({ id: unit.id })
    .from(unit)
    .where(eq(unit.courseId, courseId));

  const unitIds = courseUnitIds.map((u) => u.id);

  const completions =
    unitIds.length > 0
      ? await db
          .select({
            id: lessonCompletion.id,
            unitId: lessonCompletion.unitId,
            lessonIndex: lessonCompletion.lessonIndex,
            xpEarned: lessonCompletion.xpEarned,
            heartsLost: lessonCompletion.heartsLost,
            perfectScore: lessonCompletion.perfectScore,
            completedAt: lessonCompletion.completedAt,
          })
          .from(lessonCompletion)
          .where(
            and(
              eq(lessonCompletion.userId, userId),
              sql`${lessonCompletion.unitId} IN ${unitIds}`
            )
          )
      : [];

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

  // Get the first unit in the course
  const [firstUnit] = await db
    .select({ id: unit.id })
    .from(unit)
    .where(eq(unit.courseId, courseId))
    .limit(1);

  // Create enrollment
  const [enrollment] = await db
    .insert(userCourseEnrollment)
    .values({
      userId,
      courseId,
      currentUnitId: firstUnit?.id ?? null,
      currentLessonIndex: 0,
    })
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
