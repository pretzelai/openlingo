"use server";

import { db } from "@/lib/db";
import {
  userStats,
  userCourseEnrollment,
  lessonCompletion,
  exerciseAttempt,
  dailyActivity,
  userAchievement,
  achievementDefinition,
  unit,
  course,
} from "@/lib/db/schema";
import { eq, and, sql } from "drizzle-orm";
import { requireSession } from "@/lib/auth-server";
import { getLevelForXp } from "@/lib/game/levels";
import { computeStreak } from "@/lib/game/streaks";
import type { UnitLesson, Exercise } from "@/lib/content/types";
import { recordWordPractice } from "@/lib/actions/srs";
import { extractSrsWords } from "@/lib/srs-words";

interface CompleteLessonInput {
  unitId: string;
  lessonIndex: number;
  xpReward: number;
  results: {
    exerciseIndex: number;
    exerciseType: string;
    correct: boolean;
    userAnswer: string;
  }[];
  heartsLost: number;
}

export async function completeLesson(input: CompleteLessonInput) {
  const session = await requireSession();
  const userId = session.user.id;

  const perfectScore = input.heartsLost === 0;
  const bonusXp = perfectScore ? Math.floor(input.xpReward * 0.5) : 0;
  const xpEarned = input.xpReward + bonusXp;

  // Create lesson completion
  const [completion] = await db
    .insert(lessonCompletion)
    .values({
      userId,
      unitId: input.unitId,
      lessonIndex: input.lessonIndex,
      xpEarned,
      heartsLost: input.heartsLost,
      perfectScore,
    })
    .returning();

  // Save exercise attempts
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

  // Record SRS word practice
  try {
    const [unitRow] = await db
      .select({ exercises: unit.exercises, courseId: unit.courseId })
      .from(unit)
      .where(eq(unit.id, input.unitId));

    if (unitRow?.courseId) {
      const [courseRow] = await db
        .select({ targetLanguage: course.targetLanguage })
        .from(course)
        .where(eq(course.id, unitRow.courseId));

      if (courseRow) {
        const lessons = unitRow.exercises as UnitLesson[];
        const lesson = lessons[input.lessonIndex];
        if (lesson) {
          for (const result of input.results) {
            const exercise = lesson.exercises[result.exerciseIndex] as Exercise | undefined;
            if (!exercise) continue;
            // flashcard-review handles its own SRS via reviewCard in the component
            if (exercise.type === "flashcard-review") continue;
            const words = extractSrsWords(exercise);
            for (const w of words) {
              await recordWordPractice(userId, w, courseRow.targetLanguage, "", result.correct);
            }
          }
        }
      }
    }
  } catch {
    // SRS update is best-effort — don't block lesson completion
  }

  // Update user stats
  const [stats] = await db
    .select()
    .from(userStats)
    .where(eq(userStats.userId, userId));

  const newXp = (stats?.xp ?? 0) + xpEarned;
  const newLevel = getLevelForXp(newXp);
  const totalCompleted = (stats?.totalLessonsCompleted ?? 0) + 1;
  const newHearts = Math.max(0, (stats?.hearts ?? 5) - input.heartsLost);

  const { newStreak } = computeStreak(
    stats?.currentStreak ?? 0,
    stats?.lastPracticeDate ?? null
  );
  const longestStreak = Math.max(stats?.longestStreak ?? 0, newStreak);
  const today = new Date().toISOString().split("T")[0];

  if (stats) {
    await db
      .update(userStats)
      .set({
        xp: newXp,
        level: newLevel,
        hearts: newHearts,
        currentStreak: newStreak,
        longestStreak,
        lastPracticeDate: today,
        totalLessonsCompleted: totalCompleted,
      })
      .where(eq(userStats.userId, userId));
  } else {
    await db.insert(userStats).values({
      userId,
      xp: newXp,
      level: newLevel,
      hearts: newHearts,
      currentStreak: newStreak,
      longestStreak,
      lastPracticeDate: today,
      totalLessonsCompleted: totalCompleted,
    });
  }

  // Update daily activity (upsert)
  const [existingActivity] = await db
    .select()
    .from(dailyActivity)
    .where(
      and(eq(dailyActivity.userId, userId), eq(dailyActivity.date, today))
    );

  if (existingActivity) {
    await db
      .update(dailyActivity)
      .set({
        xpEarned: existingActivity.xpEarned + xpEarned,
        lessonsCompleted: existingActivity.lessonsCompleted + 1,
      })
      .where(eq(dailyActivity.id, existingActivity.id));
  } else {
    await db
      .insert(dailyActivity)
      .values({ userId, date: today, xpEarned, lessonsCompleted: 1 });
  }

  // Advance enrollment progress
  await advanceEnrollment(userId, input.unitId, input.lessonIndex);

  // Check achievements
  await checkAndAwardAchievements(userId, {
    totalLessonsCompleted: totalCompleted,
    streak: newStreak,
    totalXp: newXp,
    level: newLevel,
    perfectScore,
  });

  return { xpEarned, perfectScore, heartsLost: input.heartsLost };
}

async function advanceEnrollment(
  userId: string,
  unitId: string,
  completedLessonIndex: number
) {
  // Get the unit to find courseId and lesson count
  const [unitRow] = await db
    .select()
    .from(unit)
    .where(eq(unit.id, unitId));

  if (!unitRow || !unitRow.courseId) return;

  const courseId = unitRow.courseId;
  const lessons = unitRow.exercises as UnitLesson[];

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
      .where(eq(unit.courseId, courseId));

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

async function checkAndAwardAchievements(
  userId: string,
  stats: {
    totalLessonsCompleted: number;
    streak: number;
    totalXp: number;
    level: number;
    perfectScore: boolean;
  }
) {
  const definitions = await db.select().from(achievementDefinition);
  const existing = await db
    .select()
    .from(userAchievement)
    .where(eq(userAchievement.userId, userId));

  const existingIds = new Set(existing.map((a) => a.achievementId));

  // Count perfect lessons
  const [perfectCount] = await db
    .select({ count: sql<number>`count(*)` })
    .from(lessonCompletion)
    .where(
      and(
        eq(lessonCompletion.userId, userId),
        eq(lessonCompletion.perfectScore, true)
      )
    );

  for (const def of definitions) {
    if (existingIds.has(def.id)) continue;

    const req = def.requirement as { type: string; value: number };
    let earned = false;

    switch (req.type) {
      case "lessons_completed":
        earned = stats.totalLessonsCompleted >= req.value;
        break;
      case "streak":
        earned = stats.streak >= req.value;
        break;
      case "total_xp":
        earned = stats.totalXp >= req.value;
        break;
      case "level":
        earned = stats.level >= req.value;
        break;
      case "perfect_lessons":
        earned = (perfectCount?.count ?? 0) >= req.value;
        break;
    }

    if (earned) {
      await db
        .insert(userAchievement)
        .values({ userId, achievementId: def.id })
        .onConflictDoNothing();
    }
  }
}
