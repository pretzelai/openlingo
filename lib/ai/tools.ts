import { tool } from "ai";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { db, client } from "@/lib/db";
import {
  userMemory,
  course,
  unit,
  userCourseEnrollment,
  userStats,
  userPreferences,
  dictionaryWord,
  srsCard,
  article,
} from "@/lib/db/schema";
import { and, eq, gte, lte, sql } from "drizzle-orm";
import { parseExercise } from "@/lib/content/parser";
import { langCodeToName } from "@/lib/prompts";
import { supportedLanguages } from "@/lib/languages";
import { parseUnitFromMarkdown } from "@/lib/content/loader";
import { processTranslation } from "@/lib/article/process";

const ALLOWED_TABLE = /\bsrs_card\b/i;
const FORBIDDEN_TABLES =
  /\b(user|session|account|verification|user_stats|user_preferences|user_course_enrollment|lesson_completion|exercise_attempt|achievement_definition|user_achievement|daily_activity|dictionary_word|word_cache|user_memory|course|unit|audio_cache|chat_conversation|article)\b/i;

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
            and(eq(userMemory.userId, userId), eq(userMemory.key, "memory")),
          )
          .limit(1);
        return row
          ? { found: true, value: row.value }
          : { found: false, value: "" };
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
            and(eq(userMemory.userId, userId), eq(userMemory.key, "memory")),
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

    srs: tool({
      description:
        "Execute SQL on the srs_card table. $1 is always bound to the current user's ID. Returns rows for SELECT, or affected row count for mutations. Only the srs_card table is accessible.",
      inputSchema: z.object({
        sql: z.string().describe("SQL query — use $1 for user_id"),
      }),
      execute: async ({ sql: query }) => {
        if (!ALLOWED_TABLE.test(query)) {
          return { error: "Query must reference the srs_card table." };
        }
        if (FORBIDDEN_TABLES.test(query)) {
          return {
            error: "Access denied: only the srs_card table is accessible.",
          };
        }

        try {
          const rows = await client.unsafe(query, [userId]);
          const isSelect = /^\s*select/i.test(query);
          if (isSelect) {
            return { rows: Array.from(rows), count: rows.length };
          }
          return { affected: rows.count ?? rows.length };
        } catch (e) {
          return { error: (e as Error).message };
        }
      },
    }),

    presentExercise: tool({
      description:
        "Present an interactive exercise to the user. Pass the exercise as a markdown block (starting with the [type] tag) using the exercise syntax from the system prompt. The tool parses and renders it as an interactive widget. Present ONE exercise at a time and wait for the user to complete it before presenting another.",
      inputSchema: z.object({
        markdown: z
          .string()
          .describe(
            'Exercise markdown block starting with [type-tag], e.g. \'[multiple-choice]\\ntext: "What does gato mean?"\\n- "Cat" (correct)\\n- "Dog"\'',
          ),
      }),
      execute: async ({ markdown }) => {
        try {
          const exercise = parseExercise(markdown);
          return { success: true, exercise };
        } catch (e) {
          return { success: false, error: (e as Error).message };
        }
      },
    }),

    createUnit: tool({
      description:
        "Create a learning unit from exercise markdown. You (the AI) should generate the full markdown content including YAML frontmatter and ## Lesson sections following the exercise syntax from the system prompt, then pass it here. This tool parses, validates, and inserts into the DB.",
      inputSchema: z.object({
        markdown: z
          .string()
          .describe(
            "Complete unit markdown with YAML frontmatter (title, description, icon, color) and ## Lesson sections containing exercises",
          ),
        level: z
          .enum(["A1", "A2", "B1", "B2", "C1", "C2"])
          .default("B1")
          .describe("CEFR difficulty level"),
      }),
      execute: async ({ markdown, level }) => {
        const lang = language ?? "de";

        const cleaned = markdown
          .replace(/^```(?:markdown|md)?\n/m, "")
          .replace(/\n```\s*$/, "")
          .trim();

        let parsedUnit;
        const unitId = crypto.randomUUID();
        try {
          parsedUnit = parseUnitFromMarkdown(cleaned, unitId);
        } catch (err) {
          return {
            success: false,
            error: `Failed to parse markdown: ${err instanceof Error ? err.message : String(err)}`,
          };
        }

        const courseId = crypto.randomUUID();

        await db.insert(course).values({
          id: courseId,
          title: parsedUnit.title,
          sourceLanguage: "en",
          targetLanguage: lang,
          level,
          published: false,
          createdBy: userId,
        });

        await db.insert(unit).values({
          id: unitId,
          courseId,
          title: parsedUnit.title,
          description: parsedUnit.description,
          icon: parsedUnit.icon,
          color: parsedUnit.color,
          exercises: parsedUnit.lessons,
          createdBy: userId,
        });

        await db
          .insert(userCourseEnrollment)
          .values({ userId, courseId })
          .onConflictDoNothing();

        await db.insert(userStats).values({ userId }).onConflictDoNothing();

        const exerciseCount = parsedUnit.lessons.reduce(
          (sum, l) => sum + l.exercises.length,
          0,
        );

        return {
          success: true,
          courseId,
          unitId,
          title: parsedUnit.title,
          description: parsedUnit.description,
          icon: parsedUnit.icon,
          color: parsedUnit.color,
          level,
          lessonCount: parsedUnit.lessons.length,
          exerciseCount,
          lessonTitles: parsedUnit.lessons.map((l) => l.title),
        };
      },
    }),

    addWordsToSrs: tool({
      description:
        "Bulk-add words from the dictionary to the user's SRS deck. Filters by language (required), and optionally by CEFR level and/or word frequency range. Only adds words marked as useful for flashcards that aren't already in the user's deck.",
      inputSchema: z.object({
        language: z.string().describe("Language code, e.g. 'de', 'fr', 'es'"),
        cefrLevel: z
          .enum(["A1", "A2", "B1", "B2", "C1", "C2"])
          .optional()
          .describe("Filter by CEFR level (exact match)"),
        minFrequency: z
          .number()
          .int()
          .optional()
          .describe("Minimum word frequency (inclusive)"),
        maxFrequency: z
          .number()
          .int()
          .optional()
          .describe("Maximum word frequency (inclusive)"),
        limit: z
          .number()
          .int()
          .min(1)
          .max(5000)
          .default(500)
          .describe("Max words to add (default 500, max 5000)"),
      }),
      execute: async ({
        language: lang,
        cefrLevel,
        minFrequency,
        maxFrequency,
        limit: maxWords,
      }) => {
        const conditions = [
          eq(dictionaryWord.language, lang),
          eq(dictionaryWord.usefulForFlashcard, true),
        ];

        if (cefrLevel) {
          conditions.push(eq(dictionaryWord.cefrLevel, cefrLevel));
        }
        if (minFrequency !== undefined) {
          conditions.push(gte(dictionaryWord.wordFrequency, minFrequency));
        }
        if (maxFrequency !== undefined) {
          conditions.push(lte(dictionaryWord.wordFrequency, maxFrequency));
        }

        const words = await db
          .select({
            word: dictionaryWord.word,
            translation: dictionaryWord.englishTranslation,
            cefrLevel: dictionaryWord.cefrLevel,
            pos: dictionaryWord.pos,
            gender: dictionaryWord.gender,
            exampleNative: dictionaryWord.exampleSentenceNative,
            exampleEnglish: dictionaryWord.exampleSentenceEnglish,
          })
          .from(dictionaryWord)
          .where(and(...conditions))
          .orderBy(dictionaryWord.wordFrequency)
          .limit(maxWords);

        if (words.length === 0) {
          return {
            success: true,
            added: 0,
            message: "No matching words found in dictionary.",
          };
        }

        const BATCH_SIZE = 500;
        for (let i = 0; i < words.length; i += BATCH_SIZE) {
          const batch = words.slice(i, i + BATCH_SIZE);
          await db
            .insert(srsCard)
            .values(
              batch.map((w) => ({
                word: w.word.toLowerCase(),
                language: lang,
                userId,
                translation: w.translation,
                cefrLevel: w.cefrLevel,
                pos: w.pos,
                gender: w.gender,
                exampleNative: w.exampleNative,
                exampleEnglish: w.exampleEnglish,
                status: "new" as const,
                nextReviewAt: null,
              })),
            )
            .onConflictDoNothing();
        }

        return {
          success: true,
          totalMatched: words.length,
          message: `Matched ${words.length} words from dictionary and added to SRS (duplicates skipped).`,
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
            "Language code (e.g. 'fr', 'es', 'de', 'it', 'pt', 'ru', 'ar', 'hi', 'ko', 'zh', 'ja')",
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

    readArticle: tool({
      description:
        "Read a web article and translate it to a target language at a CEFR level. Creates a saved article the user can read later. Returns immediately with article ID — translation happens in background.",
      inputSchema: z.object({
        url: z.string().url().describe("The URL of the article to translate"),
        cefrLevel: z
          .enum(["A1", "A2", "B1", "B2", "C1", "C2"])
          .default("B1")
          .describe("CEFR difficulty level for the translation"),
        targetLanguage: z
          .string()
          .optional()
          .describe(
            "Language code to translate into (e.g. 'de', 'fr', 'es'). Defaults to the user's current target language.",
          ),
      }),
      execute: async ({ url, cefrLevel, targetLanguage }) => {
        const lang = targetLanguage || language || "de";
        const langName = langCodeToName[lang] || lang;

        // Check for existing article with same URL + language + level
        const [existing] = await db
          .select()
          .from(article)
          .where(
            and(
              eq(article.userId, userId),
              eq(article.sourceUrl, url),
              eq(article.targetLanguage, langName),
              eq(article.cefrLevel, cefrLevel),
            ),
          )
          .limit(1);

        if (existing?.status === "completed") {
          return {
            success: true,
            articleId: existing.id,
            status: "completed",
            title: existing.title,
            url: `/read/${existing.id}`,
            message: "This article was already translated!",
          };
        }

        if (
          existing &&
          (existing.status === "fetching" || existing.status === "translating")
        ) {
          return {
            success: true,
            articleId: existing.id,
            status: existing.status,
            url: `/read/${existing.id}`,
            message: "This article is already being translated.",
          };
        }

        // Create new article record
        const articleId = crypto.randomUUID();
        await db.insert(article).values({
          id: articleId,
          userId,
          sourceUrl: url,
          targetLanguage: langName,
          cefrLevel,
          status: "fetching",
        });

        // Start background translation (fire-and-forget)
        processTranslation(articleId, url, langName, cefrLevel).catch(
          (error) => {
            console.error(
              `[${articleId}] Background processing error:`,
              error,
            );
          },
        );

        return {
          success: true,
          articleId,
          status: "fetching",
          url: `/read/${articleId}`,
          message: `Started translating article to ${langName} at ${cefrLevel} level. The user can check progress at /read/${articleId}.`,
        };
      },
    }),
  };
}
