import { eq, sql } from "drizzle-orm";
import type { Database } from "../types";
import {
  dailyActivity,
  exerciseAttempt,
  lessonCompletion,
  unit,
  userStats,
  userUnitLibrary,
} from "../lib/db/schema";
import type { Exercise } from "../../../../lib/content/types";
import { computeStreak } from "../../../../lib/game/streaks";
import { extractSrsWords } from "../../../../lib/srs-words";
import { getUnitLessons } from "../lib/content";
import { recordWordPractice } from "./srs";

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

export async function completeLesson(
  db: Database,
  userId: string,
  input: CompleteLessonInput,
) {
  const perfectScore = input.mistakeCount === 0;
  const today = new Date().toISOString().split("T")[0];

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
        visibility: unit.visibility,
        createdBy: unit.createdBy,
      })
      .from(unit)
      .where(eq(unit.id, input.unitId)),
  ]);

  const completion = completionResult[0];
  const unitRow = unitResult[0];

  if (input.results.length > 0) {
    await db.insert(exerciseAttempt).values(
      input.results.map((result) => ({
        userId,
        lessonCompletionId: completion.id,
        exerciseIndex: result.exerciseIndex,
        exerciseType: result.exerciseType,
        correct: result.correct,
        userAnswer: result.userAnswer,
      })),
    );
  }

  const srsPromises: Promise<void>[] = [];
  if (unitRow) {
    try {
      const lessons = getUnitLessons(unitRow.markdown);
      const lesson = lessons[input.lessonIndex];
      if (lesson) {
        for (const result of input.results) {
          if (result.userAnswer === "[skipped]") continue;
          const exercise = lesson.exercises[result.exerciseIndex] as Exercise | undefined;
          if (!exercise || exercise.type === "flashcard-review") continue;
          const words = extractSrsWords(exercise);
          for (const word of words) {
            srsPromises.push(recordWordPractice(db, userId, word, unitRow.targetLanguage, "", result.correct));
          }
        }
      }
    } catch {
      // Ignore SRS extraction failures.
    }
  }

  await Promise.all([
    Promise.all(srsPromises).catch(() => {}),
    upsertUserStats(db, userId, today),
    db
      .insert(dailyActivity)
      .values({ userId, date: today, lessonsCompleted: 1 })
      .onConflictDoUpdate({
        target: [dailyActivity.userId, dailyActivity.date],
        set: { lessonsCompleted: sql`${dailyActivity.lessonsCompleted} + 1` },
      }),
    autoAddToLibrary(db, userId, unitRow),
  ]);

  return { perfectScore };
}

async function upsertUserStats(db: Database, userId: string, today: string) {
  const [stats] = await db.select().from(userStats).where(eq(userStats.userId, userId));

  const { newStreak, shouldUpdate } = computeStreak(
    stats?.currentStreak ?? 0,
    stats?.lastPracticeDate ?? null,
  );

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

async function autoAddToLibrary(
  db: Database,
  userId: string,
  unitRow:
    | {
        id: string;
        courseId: string | null;
        visibility: string | null;
        createdBy: string | null;
      }
    | undefined,
) {
  if (!unitRow) return;
  if (unitRow.courseId) return;
  if (unitRow.visibility !== "public") return;
  if (unitRow.createdBy === userId) return;

  await db.insert(userUnitLibrary).values({ userId, unitId: unitRow.id }).onConflictDoNothing();
}
