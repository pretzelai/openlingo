import {
  and,
  count,
  eq,
  inArray,
  isNotNull,
  lte,
} from "drizzle-orm";
import type { Database } from "../types";
import { srsCard } from "../lib/db/schema";
import { calculateNextReview, type CardStatus, type Quality } from "../../../../lib/srs";
import type { Exercise } from "../../../../lib/content/types";
import { extractSrsWords } from "../../../../lib/srs-words";

export async function addWordToSrs(
  db: Database,
  userId: string,
  word: string,
  language: string,
  translation: string,
) {
  await db
    .insert(srsCard)
    .values({
      word: word.toLowerCase(),
      language,
      userId,
      translation,
      status: "new",
      nextReviewAt: null,
    })
    .onConflictDoNothing();
}

export async function addOrFailWord(
  db: Database,
  userId: string,
  word: string,
  language: string,
  translation: string,
): Promise<"added" | "failed"> {
  const normalizedWord = word.toLowerCase();

  const [existing] = await db
    .select()
    .from(srsCard)
    .where(and(eq(srsCard.word, normalizedWord), eq(srsCard.language, language), eq(srsCard.userId, userId)));

  if (!existing) {
    await db.insert(srsCard).values({
      word: normalizedWord,
      language,
      userId,
      translation,
      status: "learning",
      nextReviewAt: new Date(),
    });
    return "added";
  }

  const result = calculateNextReview(
    {
      easeFactor: existing.easeFactor,
      interval: existing.interval,
      repetitions: existing.repetitions,
      status: (existing.status as CardStatus) ?? "learning",
    },
    0,
  );

  await db
    .update(srsCard)
    .set({
      easeFactor: result.easeFactor,
      interval: result.interval,
      repetitions: result.repetitions,
      status: result.status,
      nextReviewAt: result.nextReviewAt,
      lastReviewedAt: new Date(),
    })
    .where(and(eq(srsCard.word, normalizedWord), eq(srsCard.language, language), eq(srsCard.userId, userId)));

  return "failed";
}

export async function bulkAddWordsToSrs(
  db: Database,
  userId: string,
  words: { word: string; translation: string }[],
  language: string,
) {
  if (words.length === 0) return 0;

  const values = words.map((entry) => ({
    word: entry.word.toLowerCase(),
    language,
    userId,
    translation: entry.translation,
    status: "new" as const,
    nextReviewAt: null,
  }));

  const batchSize = 500;
  for (let index = 0; index < values.length; index += batchSize) {
    const batch = values.slice(index, index + batchSize);
    await db.insert(srsCard).values(batch).onConflictDoNothing();
  }

  return values.length;
}

export async function removeAllWordsFromSrs(db: Database, userId: string, language: string) {
  await db
    .delete(srsCard)
    .where(and(eq(srsCard.language, language), eq(srsCard.userId, userId)));
}

export async function removeWordFromSrs(db: Database, userId: string, word: string, language: string) {
  await db
    .delete(srsCard)
    .where(and(eq(srsCard.word, word.toLowerCase()), eq(srsCard.language, language), eq(srsCard.userId, userId)));
}

export async function getAllCards(db: Database, userId: string, language?: string) {
  const conditions = [eq(srsCard.userId, userId)];
  if (language) conditions.push(eq(srsCard.language, language));

  return db.select().from(srsCard).where(and(...conditions)).orderBy(srsCard.createdAt);
}

export async function reviewCard(
  db: Database,
  userId: string,
  word: string,
  language: string,
  quality: Quality,
) {
  const normalizedWord = word.toLowerCase();

  const [card] = await db
    .select()
    .from(srsCard)
    .where(and(eq(srsCard.word, normalizedWord), eq(srsCard.language, language), eq(srsCard.userId, userId)));

  if (!card) throw new Error("Card not found");

  const result = calculateNextReview(
    {
      easeFactor: card.easeFactor,
      interval: card.interval,
      repetitions: card.repetitions,
      status: (card.status as CardStatus) ?? "learning",
    },
    quality,
  );

  await db
    .update(srsCard)
    .set({
      easeFactor: result.easeFactor,
      interval: result.interval,
      repetitions: result.repetitions,
      status: result.status,
      nextReviewAt: result.nextReviewAt,
      lastReviewedAt: new Date(),
    })
    .where(and(eq(srsCard.word, normalizedWord), eq(srsCard.language, language), eq(srsCard.userId, userId)));

  return result;
}

export async function getSrsStats(db: Database, userId: string, language?: string) {
  const now = new Date();
  const conditions = [eq(srsCard.userId, userId)];
  if (language) conditions.push(eq(srsCard.language, language));

  const baseWhere = and(...conditions);

  const [total] = await db.select({ count: count() }).from(srsCard).where(baseWhere);
  const [due] = await db
    .select({ count: count() })
    .from(srsCard)
    .where(
      and(
        baseWhere,
        inArray(srsCard.status, ["learning", "review"]),
        isNotNull(srsCard.nextReviewAt),
        lte(srsCard.nextReviewAt, now),
      ),
    );
  const [newCards] = await db
    .select({ count: count() })
    .from(srsCard)
    .where(and(baseWhere, eq(srsCard.status, "new")));
  const [learning] = await db
    .select({ count: count() })
    .from(srsCard)
    .where(and(baseWhere, eq(srsCard.status, "learning")));
  const [review] = await db
    .select({ count: count() })
    .from(srsCard)
    .where(and(baseWhere, eq(srsCard.status, "review")));

  return {
    total: total.count,
    due: due.count,
    new: newCards.count,
    learning: learning.count,
    review: review.count,
    learned: review.count,
  };
}

export async function recordWordPractice(
  db: Database,
  userId: string,
  word: string,
  language: string,
  translation: string,
  correct: boolean,
) {
  const normalizedWord = word.toLowerCase();
  const quality: Quality = correct ? 4 : 1;

  const [existing] = await db
    .select()
    .from(srsCard)
    .where(and(eq(srsCard.word, normalizedWord), eq(srsCard.language, language), eq(srsCard.userId, userId)));

  if (!existing) {
    const result = calculateNextReview(
      { easeFactor: 2.5, interval: 0, repetitions: 0, status: "learning" },
      quality,
    );
    await db
      .insert(srsCard)
      .values({
        word: normalizedWord,
        language,
        userId,
        translation,
        status: result.status,
        easeFactor: result.easeFactor,
        interval: result.interval,
        repetitions: result.repetitions,
        nextReviewAt: result.nextReviewAt,
        lastReviewedAt: new Date(),
      })
      .onConflictDoNothing();
    return;
  }

  const result = calculateNextReview(
    {
      easeFactor: existing.easeFactor,
      interval: existing.interval,
      repetitions: existing.repetitions,
      status: (existing.status as CardStatus) ?? "learning",
    },
    quality,
  );

  await db
    .update(srsCard)
    .set({
      easeFactor: result.easeFactor,
      interval: result.interval,
      repetitions: result.repetitions,
      status: result.status,
      nextReviewAt: result.nextReviewAt,
      lastReviewedAt: new Date(),
    })
    .where(and(eq(srsCard.word, normalizedWord), eq(srsCard.language, language), eq(srsCard.userId, userId)));
}

export async function recordChatExerciseResult(
  db: Database,
  userId: string,
  exercise: Exercise,
  correct: boolean,
  language: string,
) {
  const words = extractSrsWords(exercise);
  for (const word of words) {
    await recordWordPractice(db, userId, word, language, "", correct);
  }
}
