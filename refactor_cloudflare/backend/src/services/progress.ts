import { and, count, eq, inArray } from "drizzle-orm";
import type { Database } from "../types";
import { lessonCompletion, unit, userStats } from "../lib/db/schema";

export async function getUserProgress(db: Database, userId: string, courseId: string) {
  const courseUnitIds = await db.select({ id: unit.id }).from(unit).where(eq(unit.courseId, courseId));
  const unitIds = courseUnitIds.map((entry) => entry.id);

  const completions = unitIds.length > 0
    ? await db
        .select({
          id: lessonCompletion.id,
          unitId: lessonCompletion.unitId,
          lessonIndex: lessonCompletion.lessonIndex,
          perfectScore: lessonCompletion.perfectScore,
          completedAt: lessonCompletion.completedAt,
        })
        .from(lessonCompletion)
        .where(and(eq(lessonCompletion.userId, userId), inArray(lessonCompletion.unitId, unitIds)))
    : [];

  return { completions };
}

export async function getUnitProgress(db: Database, userId: string, unitId: string) {
  const completions = await db
    .select({
      id: lessonCompletion.id,
      unitId: lessonCompletion.unitId,
      lessonIndex: lessonCompletion.lessonIndex,
      perfectScore: lessonCompletion.perfectScore,
      completedAt: lessonCompletion.completedAt,
    })
    .from(lessonCompletion)
    .where(and(eq(lessonCompletion.userId, userId), eq(lessonCompletion.unitId, unitId)));

  return { completions };
}

export async function getUserStatsData(db: Database, userId: string) {
  const [stats] = await db.select().from(userStats).where(eq(userStats.userId, userId));

  if (!stats) {
    const [created] = await db.insert(userStats).values({ userId }).returning();
    return created;
  }

  return stats;
}

export async function countCompletedLessonsForUnitIds(db: Database, userId: string, unitIds: string[]) {
  if (unitIds.length === 0) return new Map<string, number>();

  const completionCounts = await db
    .select({
      unitId: lessonCompletion.unitId,
      count: count(),
    })
    .from(lessonCompletion)
    .where(and(eq(lessonCompletion.userId, userId), inArray(lessonCompletion.unitId, unitIds)))
    .groupBy(lessonCompletion.unitId);

  return new Map(completionCounts.map((entry) => [entry.unitId, Number(entry.count)]));
}
