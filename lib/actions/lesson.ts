"use server";

import { db } from "@/lib/db";
import {
  userStats,
  userCourseEnrollment,
  lessonCompletion,
  exerciseAttempt,
  dailyActivity,
  unit,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth-server";
import { computeStreak } from "@/lib/game/streaks";
import type { Exercise } from "@/lib/content/types";
import { getUnitLessons } from "@/lib/content/loader";
import { recordWordPractice } from "@/lib/actions/srs";
import { extractSrsWords } from "@/lib/srs-words";

interface CompleteLessonInput {
  unitId: string;
  lessonIndex: number;
  results: {
    exerciseIndex: number;
    exerciseType: string;
    correct: boolean;
    userAnswer: string;
  }[];
  mistakeCount: number;
}

export async function completeLesson(input: CompleteLessonInput) {
  const session = await requireSession();
  const userId = session.user.id;

  const perfectScore = input.mistakeCount === 0;
  const today = new Date().toISOString().split("T")[0];

  // Create lesson completion + fetch unit row in parallel
  const [completionResult, unitResult] = await Promise.all([
    db
      .insert(lessonCompletion)
      .values({
        userId,
        unitId: input.unitId,
        lessonIndex: input.lessonIndex,
        perfectScore,
      })
      .returning(),
    db
      .select({
        id: unit.id,
        courseId: unit.courseId,
        markdown: unit.markdown,
        targetLanguage: unit.targetLanguage,
      })
      .from(unit)
      .where(eq(unit.id, input.unitId)),
  ]);

  const completion = completionResult[0];
  const unitRow = unitResult[0];

  // Save exercise attempts (depends on completion.id)
  if (input.results.length > 0) {
    await db.insert(exerciseAttempt).values(
      input.results.map((r) => ({
        userId,
        lessonCompletionId: completion.id,
        exerciseIndex: r.exerciseIndex,
        exerciseType: r.exerciseType,
        correct: r.correct,
        userAnswer: r.userAnswer,
      }))
    );
  }

  // Collect all SRS word practice calls (to run in parallel instead of sequentially)
  const srsPromises: Promise<void>[] = [];
  if (unitRow) {
    try {
      const lessons = getUnitLessons(unitRow.markdown);
      const lesson = lessons[input.lessonIndex];
      if (lesson) {
        for (const result of input.results) {
          const exercise = lesson.exercises[result.exerciseIndex] as Exercise | undefined;
          if (!exercise) continue;
          if (exercise.type === "flashcard-review") continue;
          const words = extractSrsWords(exercise);
          for (const w of words) {
            srsPromises.push(
              recordWordPractice(userId, w, unitRow.targetLanguage, "", result.correct)
            );
          }
        }
      }
    } catch {
      // SRS extraction error — continue without SRS
    }
  }

  // Run SRS updates, stats upsert, daily activity upsert, and enrollment advance in parallel
  // These are all independent of each other
  await Promise.all([
    // SRS word practice — all words in parallel (best-effort)
    Promise.all(srsPromises).catch(() => {}),

    // Upsert user stats (single query instead of SELECT + conditional INSERT/UPDATE)
    upsertUserStats(userId, today),

    // Upsert daily activity (single query instead of SELECT + conditional INSERT/UPDATE)
    db
      .insert(dailyActivity)
      .values({ userId, date: today, lessonsCompleted: 1 })
      .onConflictDoUpdate({
        target: [dailyActivity.userId, dailyActivity.date],
        set: {
          lessonsCompleted: sql`${dailyActivity.lessonsCompleted} + 1`,
        },
      }),

    // Advance enrollment progress (pass unitRow to avoid duplicate fetch)
    advanceEnrollment(userId, input.unitId, input.lessonIndex, unitRow),
  ]);

  return { perfectScore };
}

async function upsertUserStats(userId: string, today: string) {
  // Fetch current stats to compute streak
  const [stats] = await db
    .select()
    .from(userStats)
    .where(eq(userStats.userId, userId));

  const { newStreak, shouldUpdate } = computeStreak(
    stats?.currentStreak ?? 0,
    stats?.lastPracticeDate ?? null
  );

  // Always increment lesson count; only update streak fields if needed
  const totalCompleted = (stats?.totalLessonsCompleted ?? 0) + 1;
  const longestStreak = Math.max(stats?.longestStreak ?? 0, newStreak);

  if (stats) {
    if (shouldUpdate) {
      await db
        .update(userStats)
        .set({
          currentStreak: newStreak,
          longestStreak,
          lastPracticeDate: today,
          totalLessonsCompleted: totalCompleted,
        })
        .where(eq(userStats.userId, userId));
    } else {
      // Already practiced today — only increment lesson count
      await db
        .update(userStats)
        .set({ totalLessonsCompleted: totalCompleted })
        .where(eq(userStats.userId, userId));
    }
  } else {
    await db.insert(userStats).values({
      userId,
      currentStreak: newStreak,
      longestStreak,
      lastPracticeDate: today,
      totalLessonsCompleted: totalCompleted,
    });
  }
}

async function advanceEnrollment(
  userId: string,
  unitId: string,
  completedLessonIndex: number,
  unitRow: { id: string; courseId: string | null; markdown: string; targetLanguage: string } | undefined
) {
  if (!unitRow || !unitRow.courseId) return;

  const courseId = unitRow.courseId;
  const lessons = getUnitLessons(unitRow.markdown);

  // Get enrollment
  const [enrollment] = await db
    .select()
    .from(userCourseEnrollment)
    .where(
      and(
        eq(userCourseEnrollment.userId, userId),
        eq(userCourseEnrollment.courseId, courseId)
      )
    );

  if (!enrollment) return;

  // Only advance if user is on this unit and lesson
  if (
    enrollment.currentUnitId !== unitId ||
    enrollment.currentLessonIndex !== completedLessonIndex
  ) {
    return;
  }

  const nextLessonIndex = completedLessonIndex + 1;

  if (nextLessonIndex < lessons.length) {
    // Move to next lesson in same unit
    await db
      .update(userCourseEnrollment)
      .set({ currentLessonIndex: nextLessonIndex })
      .where(eq(userCourseEnrollment.id, enrollment.id));
  } else {
    // Completed all lessons in this unit — move to next unit
    const courseUnits = await db
      .select({ id: unit.id })
      .from(unit)
      .where(eq(unit.courseId, courseId))
      .orderBy(unit.createdAt);

    const currentIdx = courseUnits.findIndex((u) => u.id === unitId);
    const nextUnit = courseUnits[currentIdx + 1];

    if (nextUnit) {
      await db
        .update(userCourseEnrollment)
        .set({
          currentUnitId: nextUnit.id,
          currentLessonIndex: 0,
        })
        .where(eq(userCourseEnrollment.id, enrollment.id));
    }
    // else: course completed — stays at last unit/lesson
  }
}

