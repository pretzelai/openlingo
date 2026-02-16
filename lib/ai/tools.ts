import { tool, generateObject } from "ai";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  userMemory,
  srsCard,
  course,
  unit,
  userCourseEnrollment,
  userStats,
  userPreferences,
} from "@/lib/db/schema";
import { and, eq, lte, count, sql } from "drizzle-orm";
import { calculateNextReview, type Quality } from "@/lib/srs";
import { exerciseSchema, generatedUnitSchema } from "./exercise-schema";
import {
  lookupWord as wordLookup,
  getWordsByLevel,
} from "@/lib/words";
import { langCodeToName } from "@/lib/prompts";
import { supportedLanguages } from "@/lib/languages";
import { getModel } from "./models";

export function createTools(userId: string, language?: string) {
  return {
    readMemory: tool({
      description:
        "Read everything stored in the user's memory. Returns free-text notes that accumulate over time.",
      inputSchema: z.object({}),
      execute: async () => {
        const [row] = await db
          .select()
          .from(userMemory)
          .where(
            and(eq(userMemory.userId, userId), eq(userMemory.key, "memory"))
          )
          .limit(1);
        return row ? { found: true, value: row.value } : { found: false, value: "" };
      },
    }),

    addMemory: tool({
      description:
        "Append a line to the user's memory. The text is added after a line break at the end of existing memory.",
      inputSchema: z.object({
        text: z.string().describe("The text to append to memory"),
      }),
      execute: async ({ text }) => {
        const [existing] = await db
          .select()
          .from(userMemory)
          .where(
            and(eq(userMemory.userId, userId), eq(userMemory.key, "memory"))
          )
          .limit(1);

        const newValue = existing ? existing.value + "\n" + text : text;

        await db
          .insert(userMemory)
          .values({ userId, key: "memory", value: newValue })
          .onConflictDoUpdate({
            target: [userMemory.userId, userMemory.key],
            set: { value: newValue, updatedAt: new Date() },
          });
        return { success: true };
      },
    }),

    rewriteAllMemory: tool({
      description:
        "Replace the user's entire memory with new content. Use when memory needs to be reorganized or cleaned up.",
      inputSchema: z.object({
        value: z
          .string()
          .describe("The new content to replace all existing memory"),
      }),
      execute: async ({ value }) => {
        await db
          .insert(userMemory)
          .values({ userId, key: "memory", value })
          .onConflictDoUpdate({
            target: [userMemory.userId, userMemory.key],
            set: { value, updatedAt: new Date() },
          });
        return { success: true };
      },
    }),

    getDueCards: tool({
      description: "Get SRS cards that are due for review",
      inputSchema: z.object({
        limit: z
          .number()
          .optional()
          .default(20)
          .describe("Max cards to return"),
      }),
      execute: async ({ limit }) => {
        const now = new Date();
        const conditions = [
          eq(srsCard.userId, userId),
          lte(srsCard.nextReviewAt, now),
        ];
        if (language) {
          conditions.push(eq(srsCard.language, language));
        }
        const cards = await db
          .select()
          .from(srsCard)
          .where(and(...conditions))
          .orderBy(srsCard.nextReviewAt)
          .limit(limit);
        return { cards, count: cards.length };
      },
    }),

    getSrsStats: tool({
      description:
        "Get SRS statistics: total cards, due cards, and learned cards",
      inputSchema: z.object({}),
      execute: async () => {
        const now = new Date();
        const conditions = [eq(srsCard.userId, userId)];
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
          .where(and(baseWhere, lte(srsCard.nextReviewAt, now)));

        const [learned] = await db
          .select({ count: count() })
          .from(srsCard)
          .where(and(baseWhere, sql`${srsCard.repetitions} >= 3`));

        return {
          total: total.count,
          due: due.count,
          learned: learned.count,
        };
      },
    }),

    addWordToSrs: tool({
      description:
        "Add a new word to the user's SRS deck with auto-enrichment from dictionary/AI",
      inputSchema: z.object({
        word: z.string().describe("The word in the target language"),
        translation: z
          .string()
          .optional()
          .describe("English translation (auto-filled if omitted)"),
      }),
      execute: async ({ word, translation }) => {
        const lang = language ?? "de";
        const normalized = word.toLowerCase();

        // Look up enrichment data
        const lookup = await wordLookup(word, lang);

        const finalTranslation =
          translation || lookup.translation || word;

        await db
          .insert(srsCard)
          .values({
            word: normalized,
            language: lang,
            userId,
            translation: finalTranslation,
            cefrLevel: lookup.cefrLevel ?? null,
            pos: lookup.pos ?? null,
            gender: lookup.gender ?? null,
            exampleNative: lookup.exampleNative ?? null,
            exampleEnglish: lookup.exampleEnglish ?? null,
            nextReviewAt: new Date(),
          })
          .onConflictDoUpdate({
            target: [srsCard.word, srsCard.language, srsCard.userId],
            set: {
              // Backfill enrichment but don't overwrite SRS scheduling fields
              cefrLevel: sql`COALESCE(${srsCard.cefrLevel}, excluded.cefr_level)`,
              pos: sql`COALESCE(${srsCard.pos}, excluded.pos)`,
              gender: sql`COALESCE(${srsCard.gender}, excluded.gender)`,
              exampleNative: sql`COALESCE(${srsCard.exampleNative}, excluded.example_native)`,
              exampleEnglish: sql`COALESCE(${srsCard.exampleEnglish}, excluded.example_english)`,
            },
          });

        return {
          success: true,
          word: normalized,
          translation: finalTranslation,
          cefrLevel: lookup.cefrLevel ?? null,
          pos: lookup.pos ?? null,
          source: lookup.source ?? null,
        };
      },
    }),

    addWordsByLevel: tool({
      description:
        "Batch-add words at a specific CEFR level (A1-C2) from the dictionary to the user's SRS deck",
      inputSchema: z.object({
        level: z
          .enum(["A1", "A2", "B1", "B2", "C1", "C2"])
          .describe("CEFR level"),
        limit: z
          .number()
          .optional()
          .default(50)
          .describe("Max words to add (default 50, max 500)"),
      }),
      execute: async ({ level, limit }) => {
        const lang = language ?? "de";
        const cap = Math.min(limit, 500);

        const words = await getWordsByLevel(lang, level);
        const batch = words.slice(0, cap);

        if (batch.length === 0) {
          return { added: 0, totalAvailable: 0, level };
        }

        const now = new Date();
        const rows = batch.map((w) => ({
          word: w.word.toLowerCase(),
          language: lang,
          userId,
          translation: w.english_translation,
          cefrLevel: w.cefr_level,
          pos: w.pos,
          gender: w.gender || null,
          exampleNative: w.example_sentence_native,
          exampleEnglish: w.example_sentence_english,
          nextReviewAt: now,
        }));

        await db.insert(srsCard).values(rows).onConflictDoNothing();

        return {
          added: batch.length,
          totalAvailable: words.length,
          level,
        };
      },
    }),

    lookupWord: tool({
      description:
        "Look up a word in the dictionary or via AI without adding it to SRS. Returns translation, part of speech, gender, CEFR level, and examples.",
      inputSchema: z.object({
        word: z.string().describe("The word to look up"),
      }),
      execute: async ({ word }) => {
        const lang = language ?? "de";
        return wordLookup(word, lang);
      },
    }),

    removeWord: tool({
      description: "Remove a word from the user's SRS deck",
      inputSchema: z.object({
        word: z.string().describe("The word to remove"),
      }),
      execute: async ({ word }) => {
        const lang = language ?? "de";
        const deleted = await db
          .delete(srsCard)
          .where(
            and(
              eq(srsCard.word, word.toLowerCase()),
              eq(srsCard.language, lang),
              eq(srsCard.userId, userId)
            )
          )
          .returning({ word: srsCard.word });

        if (deleted.length === 0) {
          return { success: false, error: "Card not found" };
        }
        return { success: true, word: deleted[0].word };
      },
    }),

    listCards: tool({
      description: "List words in the user's SRS deck",
      inputSchema: z.object({
        level: z
          .enum(["A1", "A2", "B1", "B2", "C1", "C2"])
          .optional()
          .describe("Filter by CEFR level"),
        limit: z
          .number()
          .optional()
          .default(50)
          .describe("Max cards to return"),
        offset: z
          .number()
          .optional()
          .default(0)
          .describe("Offset for pagination"),
      }),
      execute: async ({ level, limit, offset }) => {
        const conditions = [eq(srsCard.userId, userId)];
        if (language) {
          conditions.push(eq(srsCard.language, language));
        }
        if (level) {
          conditions.push(eq(srsCard.cefrLevel, level));
        }

        const cards = await db
          .select({
            word: srsCard.word,
            translation: srsCard.translation,
            cefrLevel: srsCard.cefrLevel,
            pos: srsCard.pos,
            gender: srsCard.gender,
            interval: srsCard.interval,
            repetitions: srsCard.repetitions,
            nextReviewAt: srsCard.nextReviewAt,
          })
          .from(srsCard)
          .where(and(...conditions))
          .orderBy(srsCard.word)
          .limit(limit)
          .offset(offset);

        return { cards, count: cards.length };
      },
    }),

    reviewCard: tool({
      description:
        "Update an SRS card after practice. Quality: 0=blackout, 1=wrong, 2=wrong but close, 3=correct with difficulty, 4=correct, 5=perfect",
      inputSchema: z.object({
        word: z.string().describe("The word to review"),
        quality: z
          .number()
          .int()
          .min(0)
          .max(5)
          .describe("Review quality score 0-5"),
      }),
      execute: async ({ word, quality }) => {
        const lang = language ?? "de";
        const normalizedWord = word.toLowerCase();

        const [card] = await db
          .select()
          .from(srsCard)
          .where(
            and(
              eq(srsCard.word, normalizedWord),
              eq(srsCard.language, lang),
              eq(srsCard.userId, userId)
            )
          );

        if (!card) return { success: false, error: "Card not found" };

        const result = calculateNextReview(
          {
            easeFactor: card.easeFactor,
            interval: card.interval,
            repetitions: card.repetitions,
          },
          quality as Quality
        );

        await db
          .update(srsCard)
          .set({
            easeFactor: result.easeFactor,
            interval: result.interval,
            repetitions: result.repetitions,
            nextReviewAt: result.nextReviewAt,
            lastReviewedAt: new Date(),
          })
          .where(
            and(
              eq(srsCard.word, normalizedWord),
              eq(srsCard.language, lang),
              eq(srsCard.userId, userId)
            )
          );

        return {
          success: true,
          nextReviewAt: result.nextReviewAt.toISOString(),
          interval: result.interval,
        };
      },
    }),

    presentExercise: tool({
      description:
        "Present an interactive exercise to the user. The exercise renders as an interactive widget in the chat. Present ONE exercise at a time and wait for the user to complete it before presenting another.",
      inputSchema: z.object({
        exercise: exerciseSchema,
      }),
      execute: async ({ exercise }) => {
        return { presented: true, exerciseType: exercise.type };
      },
    }),

    createUnit: tool({
      description:
        "Generate a full learning unit on any topic. Creates a course with lessons and exercises, auto-enrolls the user, and returns a summary card. Use when the user asks to create a unit, lesson, or course on a specific topic.",
      inputSchema: z.object({
        topic: z.string().describe("The topic to create a unit about"),
        level: z
          .enum(["A1", "A2", "B1", "B2", "C1", "C2"])
          .default("B1")
          .describe("CEFR difficulty level"),
        lessonCount: z
          .number()
          .int()
          .min(3)
          .max(6)
          .default(4)
          .describe("Number of lessons to generate"),
      }),
      execute: async ({ topic, level, lessonCount }) => {
        const lang = language ?? "de";

        const { object: generatedUnit } = await generateObject({
          model: getModel("gemini-2.5-flash"),
          schema: generatedUnitSchema,
          prompt: `You are a curriculum designer for a ${lang} language learning app.

Create a learning unit about: "${topic}"
CEFR level: ${level}
Number of lessons: ${lessonCount}

Requirements:
- Each lesson should have 3-5 varied exercises (multiple-choice, translation, fill-in-the-blank, matching-pairs, word-bank, listening)
- Use vocabulary and grammar appropriate for ${level} level
- Exercises should progress from easier to harder within each lesson
- For listening exercises, set ttsLang to "${lang}"
- For multiple-choice: provide 3 choices
- For translation: include 1-2 alternative answers in acceptAlso
- For fill-in-the-blank: use ___ as the blank placeholder
- For matching-pairs: use 3-4 pairs
- For word-bank: include 1-2 distractor words
- Make the content practical and engaging
- XP rewards: 10 for easy lessons, 15-20 for medium, 25-30 for hard`,
        });

        const courseId = crypto.randomUUID();
        const unitId = crypto.randomUUID();

        await db.insert(course).values({
          id: courseId,
          title: generatedUnit.title,
          sourceLanguage: "en",
          targetLanguage: lang,
          level,
          published: false,
          createdBy: userId,
        });

        await db.insert(unit).values({
          id: unitId,
          courseId,
          title: generatedUnit.title,
          description: generatedUnit.description,
          icon: generatedUnit.icon,
          color: generatedUnit.color,
          exercises: generatedUnit.lessons,
          createdBy: userId,
        });

        await db
          .insert(userCourseEnrollment)
          .values({ userId, courseId })
          .onConflictDoNothing();

        await db
          .insert(userStats)
          .values({ userId })
          .onConflictDoNothing();

        const exerciseCount = generatedUnit.lessons.reduce(
          (sum, l) => sum + l.exercises.length,
          0
        );

        return {
          success: true,
          courseId,
          unitId,
          title: generatedUnit.title,
          description: generatedUnit.description,
          icon: generatedUnit.icon,
          color: generatedUnit.color,
          level,
          lessonCount: generatedUnit.lessons.length,
          exerciseCount,
          lessonTitles: generatedUnit.lessons.map((l) => l.title),
        };
      },
    }),

    switchLanguage: tool({
      description:
        "Switch the user's target language globally. Changes which language they're learning across all pages.",
      inputSchema: z.object({
        language: z
          .string()
          .describe(
            "Language code (e.g. 'fr', 'es', 'de', 'it', 'pt', 'ru', 'ar', 'hi', 'ko', 'zh', 'ja')"
          ),
      }),
      execute: async ({ language: langCode }) => {
        if (!supportedLanguages[langCode]) {
          const supported = Object.keys(supportedLanguages)
            .filter((k) => k !== "en")
            .map((k) => `${k} (${langCodeToName[k] || k})`)
            .join(", ");
          return {
            success: false,
            error: `Unsupported language "${langCode}". Supported: ${supported}`,
          };
        }

        await db
          .insert(userPreferences)
          .values({ userId, targetLanguage: langCode })
          .onConflictDoUpdate({
            target: userPreferences.userId,
            set: { targetLanguage: langCode, updatedAt: new Date() },
          });

        revalidatePath("/");

        const name = langCodeToName[langCode] || langCode;
        return {
          success: true,
          language: langCode,
          languageName: name,
          message: `Switched target language to ${name}. All pages will now use ${name}.`,
        };
      },
    }),
  };
}
