"use server";

import { db } from "@/lib/db";
import { srsCard } from "@/lib/db/schema";
import { and, eq, lte, gt, count, sql, asc, isNotNull, inArray } from "drizzle-orm";
import { requireSession } from "@/lib/auth-server";
import { calculateNextReview, type Quality, type CardStatus } from "@/lib/srs";

export async function addWordToSrs(
  word: string,
  language: string,
  translation: string
) {
  const session = await requireSession();

  await db
    .insert(srsCard)
    .values({
      word: word.toLowerCase(),
      language,
      userId: session.user.id,
      translation,
      status: "new",
      nextReviewAt: null,
    })
    .onConflictDoNothing();
}

/**
 * Add a word to SRS if new, or mark it as failed to remember if it already exists.
 * New words go to "learning" with nextReviewAt = now (tooltip path — user is actively studying).
 * Returns "added" if the word was newly added, "failed" if it was reset.
 */
export async function addOrFailWord(
  word: string,
  language: string,
  translation: string
): Promise<"added" | "failed"> {
  const session = await requireSession();
  const userId = session.user.id;
  const normalizedWord = word.toLowerCase();

  const [existing] = await db
    .select()
    .from(srsCard)
    .where(
      and(
        eq(srsCard.word, normalizedWord),
        eq(srsCard.language, language),
        eq(srsCard.userId, userId)
      )
    );

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

  // Already exists — mark as failed to remember (quality = 0)
  const result = calculateNextReview(
    {
      easeFactor: existing.easeFactor,
      interval: existing.interval,
      repetitions: existing.repetitions,
      status: (existing.status as CardStatus) ?? "learning",
    },
    0
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
    .where(
      and(
        eq(srsCard.word, normalizedWord),
        eq(srsCard.language, language),
        eq(srsCard.userId, userId)
      )
    );

  return "failed";
}

export async function bulkAddWordsToSrs(
  words: { word: string; translation: string }[],
  language: string
) {
  const session = await requireSession();

  if (words.length === 0) return 0;

  const values = words.map((w) => ({
    word: w.word.toLowerCase(),
    language,
    userId: session.user.id,
    translation: w.translation,
    status: "new" as const,
    nextReviewAt: null,
  }));

  // Insert in batches of 500 to avoid query size limits
  const BATCH_SIZE = 500;
  for (let i = 0; i < values.length; i += BATCH_SIZE) {
    const batch = values.slice(i, i + BATCH_SIZE);
    await db.insert(srsCard).values(batch).onConflictDoNothing();
  }

  return values.length;
}

export async function removeAllWordsFromSrs(language: string) {
  const session = await requireSession();

  await db
    .delete(srsCard)
    .where(
      and(
        eq(srsCard.language, language),
        eq(srsCard.userId, session.user.id)
      )
    );
}

export async function removeWordFromSrs(word: string, language: string) {
  const session = await requireSession();

  await db
    .delete(srsCard)
    .where(
      and(
        eq(srsCard.word, word.toLowerCase()),
        eq(srsCard.language, language),
        eq(srsCard.userId, session.user.id)
      )
    );
}

export async function getDueCards(language?: string, limit = 20) {
  const session = await requireSession();
  const now = new Date();

  const conditions = [
    eq(srsCard.userId, session.user.id),
    inArray(srsCard.status, ["learning", "review"]),
    isNotNull(srsCard.nextReviewAt),
    lte(srsCard.nextReviewAt, now),
  ];

  if (language) {
    conditions.push(eq(srsCard.language, language));
  }

  return db
    .select()
    .from(srsCard)
    .where(and(...conditions))
    .orderBy(srsCard.nextReviewAt)
    .limit(limit);
}

export async function getScheduledCards(language?: string, limit = 20) {
  const session = await requireSession();
  const now = new Date();

  const conditions = [
    eq(srsCard.userId, session.user.id),
    inArray(srsCard.status, ["learning", "review"]),
    isNotNull(srsCard.nextReviewAt),
    gt(srsCard.nextReviewAt, now),
  ];

  if (language) {
    conditions.push(eq(srsCard.language, language));
  }

  return db
    .select()
    .from(srsCard)
    .where(and(...conditions))
    .orderBy(srsCard.nextReviewAt)
    .limit(limit);
}

export async function getAllCards(language?: string) {
  const session = await requireSession();

  const conditions = [eq(srsCard.userId, session.user.id)];

  if (language) {
    conditions.push(eq(srsCard.language, language));
  }

  return db
    .select()
    .from(srsCard)
    .where(and(...conditions))
    .orderBy(srsCard.createdAt);
}

export async function reviewCard(
  word: string,
  language: string,
  quality: Quality
) {
  const session = await requireSession();
  const userId = session.user.id;
  const normalizedWord = word.toLowerCase();

  const [card] = await db
    .select()
    .from(srsCard)
    .where(
      and(
        eq(srsCard.word, normalizedWord),
        eq(srsCard.language, language),
        eq(srsCard.userId, userId)
      )
    );

  if (!card) throw new Error("Card not found");

  const result = calculateNextReview(
    {
      easeFactor: card.easeFactor,
      interval: card.interval,
      repetitions: card.repetitions,
      status: (card.status as CardStatus) ?? "learning",
    },
    quality
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
    .where(
      and(
        eq(srsCard.word, normalizedWord),
        eq(srsCard.language, language),
        eq(srsCard.userId, userId)
      )
    );

  return result;
}

export async function getSrsStats(language?: string) {
  const session = await requireSession();
  const now = new Date();

  const conditions = [eq(srsCard.userId, session.user.id)];
  if (language) {
    conditions.push(eq(srsCard.language, language));
  }

  const baseWhere = and(...conditions);

  const [total] = await db
    .select({ count: count() })
    .from(srsCard)
    .where(baseWhere);

  const [due] = await db
    .select({ count: count() })
    .from(srsCard)
    .where(
      and(
        baseWhere,
        inArray(srsCard.status, ["learning", "review"]),
        isNotNull(srsCard.nextReviewAt),
        lte(srsCard.nextReviewAt, now)
      )
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
    learned: review.count, // alias for backwards compat
  };
}

export async function getNewCards(language: string, limit = 20) {
  const session = await requireSession();

  return db
    .select()
    .from(srsCard)
    .where(
      and(
        eq(srsCard.userId, session.user.id),
        eq(srsCard.language, language),
        eq(srsCard.status, "new")
      )
    )
    .orderBy(asc(srsCard.createdAt))
    .limit(limit);
}

export async function introduceNewCards(language: string, count_: number) {
  const session = await requireSession();
  const userId = session.user.id;

  const cards = await db
    .select()
    .from(srsCard)
    .where(
      and(
        eq(srsCard.userId, userId),
        eq(srsCard.language, language),
        eq(srsCard.status, "new")
      )
    )
    .orderBy(asc(srsCard.createdAt))
    .limit(count_);

  if (cards.length === 0) return [];

  const now = new Date();

  // Update all selected cards to learning status
  await db
    .update(srsCard)
    .set({
      status: "learning",
      nextReviewAt: now,
    })
    .where(
      and(
        eq(srsCard.userId, userId),
        eq(srsCard.language, language),
        eq(srsCard.status, "new"),
        inArray(
          srsCard.word,
          cards.map((c) => c.word)
        )
      )
    );

  return cards.map((c) => ({ ...c, status: "learning" as const, nextReviewAt: now }));
}
