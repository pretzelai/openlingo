import { generateObject } from "ai";
import { z } from "zod";
import { getModel } from "@/lib/ai";
import { db } from "@/lib/db";
import { dictionaryWord, wordCache } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import {
  getDefaultTemplate,
  interpolateTemplate,
  langCodeToName,
} from "@/lib/prompts";

export interface WordEntry {
  word: string;
  pos: string;
  cefr_level: string;
  english_translation: string;
  example_sentence_native: string;
  example_sentence_english: string;
  gender: string;
  useful_for_flashcard?: boolean;
  word_frequency?: number;
}

function rowToWordEntry(row: typeof dictionaryWord.$inferSelect): WordEntry {
  return {
    word: row.word,
    pos: row.pos ?? "",
    cefr_level: row.cefrLevel ?? "",
    english_translation: row.englishTranslation,
    example_sentence_native: row.exampleSentenceNative ?? "",
    example_sentence_english: row.exampleSentenceEnglish ?? "",
    gender: row.gender ?? "",
    useful_for_flashcard: row.usefulForFlashcard ?? true,
    word_frequency: row.wordFrequency ?? undefined,
  };
}

export async function loadLanguageRaw(langCode: string): Promise<WordEntry[]> {
  const rows = await db
    .select()
    .from(dictionaryWord)
    .where(eq(dictionaryWord.language, langCode));

  return rows.map(rowToWordEntry);
}

export async function loadLanguage(
  langCode: string
): Promise<Map<string, WordEntry>> {
  const words = await loadLanguageRaw(langCode);
  const map = new Map<string, WordEntry>();
  for (const w of words) {
    map.set(w.word.toLowerCase(), w);
  }
  return map;
}

const wordAnalysisSchema = z.object({
  baseForm: z.string().describe("The dictionary/base form of the word"),
  translation: z.string().describe("English translation"),
  pos: z
    .string()
    .describe(
      "Part of speech (noun/verb/adjective/adverb/preposition/conjunction/article/pronoun)"
    ),
  gender: z
    .string()
    .nullable()
    .describe(
      "Grammatical gender if applicable (masculine/feminine/neuter)"
    ),
  cefrLevel: z.string().describe("CEFR level (A1/A2/B1/B2/C1/C2)"),
  exampleNative: z
    .string()
    .describe("A simple example sentence using this word"),
  exampleEnglish: z
    .string()
    .describe("English translation of the example sentence"),
});

export async function aiLookup(word: string, language: string) {
  const normalizedWord = word.toLowerCase().trim();
  const langName = langCodeToName[language] || language;

  // Check DB cache first
  const cached = await db
    .select()
    .from(wordCache)
    .where(
      and(eq(wordCache.word, normalizedWord), eq(wordCache.language, language))
    )
    .limit(1);

  if (cached.length > 0) {
    const c = cached[0];
    return {
      found: true as const,
      source: "ai" as const,
      word: c.baseForm || normalizedWord,
      translation: c.translation,
      pos: c.pos || null,
      gender: c.gender || null,
      cefrLevel: c.cefrLevel || null,
      exampleNative: c.exampleNative || null,
      exampleEnglish: c.exampleEnglish || null,
    };
  }

  try {
    const promptTemplate = getDefaultTemplate("word-analysis");
    const prompt = interpolateTemplate(promptTemplate, { langName, word });

    const { object: analysis } = await generateObject({
      model: getModel("gemini-2.5-flash-lite"),
      schema: wordAnalysisSchema,
      prompt,
    });

    // Cache in DB (fire and forget)
    db.insert(wordCache)
      .values({
        word: normalizedWord,
        language,
        baseForm: analysis.baseForm || normalizedWord,
        translation: analysis.translation,
        pos: analysis.pos || null,
        gender: analysis.gender || null,
        cefrLevel: analysis.cefrLevel || null,
        exampleNative: analysis.exampleNative || null,
        exampleEnglish: analysis.exampleEnglish || null,
      })
      .onConflictDoNothing()
      .catch((err: unknown) => {
        console.error("Failed to cache word:", err);
      });

    return {
      found: true as const,
      source: "ai" as const,
      word: analysis.baseForm || word,
      translation: analysis.translation,
      pos: analysis.pos || null,
      gender: analysis.gender || null,
      cefrLevel: analysis.cefrLevel || null,
      exampleNative: analysis.exampleNative || null,
      exampleEnglish: analysis.exampleEnglish || null,
    };
  } catch (err) {
    console.error("AI lookup failed:", err);
    return null;
  }
}

export type WordLookupResult = {
  found: boolean;
  source?: "dictionary" | "ai";
  word: string;
  translation?: string;
  pos?: string | null;
  gender?: string | null;
  cefrLevel?: string | null;
  exampleNative?: string | null;
  exampleEnglish?: string | null;
};

export async function lookupWord(
  word: string,
  language: string
): Promise<WordLookupResult> {
  // 1. Try dictionary (single row query, no full load)
  const [entry] = await db
    .select()
    .from(dictionaryWord)
    .where(
      and(
        eq(dictionaryWord.word, word.toLowerCase()),
        eq(dictionaryWord.language, language)
      )
    )
    .limit(1);

  if (entry) {
    return {
      found: true,
      source: "dictionary",
      word: entry.word,
      translation: entry.englishTranslation,
      pos: entry.pos,
      gender: entry.gender || null,
      cefrLevel: entry.cefrLevel,
      exampleNative: entry.exampleSentenceNative,
      exampleEnglish: entry.exampleSentenceEnglish,
    };
  }

  // 2. Try AI fallback
  const aiResult = await aiLookup(word, language);
  if (aiResult) {
    return aiResult;
  }

  // 3. Not found
  return { found: false, word };
}

export async function getWordsByLevel(
  language: string,
  level: string
): Promise<WordEntry[]> {
  const upperLevel = level.toUpperCase();
  const rows = await db
    .select()
    .from(dictionaryWord)
    .where(
      and(
        eq(dictionaryWord.language, language),
        eq(dictionaryWord.cefrLevel, upperLevel)
      )
    );

  return rows
    .filter((r) => r.usefulForFlashcard !== false)
    .map(rowToWordEntry);
}
