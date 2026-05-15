import { generateObject } from "ai";
import { z } from "zod";
import { and, eq } from "drizzle-orm";
import type { Database } from "../types";
import { dictionaryWord, wordCache } from "../lib/db/schema";
import { getModel } from "../../../../lib/ai/models";
import {
  getDefaultTemplate,
  interpolateTemplate,
  langCodeToName,
} from "../../../../lib/prompts";

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
  goethe_b1_wordlist?: boolean;
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
    goethe_b1_wordlist: row.goetheB1Wordlist ?? undefined,
  };
}

export async function loadLanguageRaw(db: Database, langCode: string): Promise<WordEntry[]> {
  const rows = await db
    .select()
    .from(dictionaryWord)
    .where(eq(dictionaryWord.language, langCode));

  return rows.map(rowToWordEntry);
}

const wordAnalysisSchema = z.object({
  baseForm: z.string(),
  translation: z.string(),
  pos: z.string(),
  gender: z.string().nullable(),
  cefrLevel: z.string(),
  exampleNative: z.string(),
  exampleEnglish: z.string(),
});

export async function aiLookup(db: Database, word: string, language: string) {
  const normalizedWord = word.toLowerCase().trim();
  const targetLanguage = langCodeToName[language] || language;

  const cached = await db
    .select()
    .from(wordCache)
    .where(and(eq(wordCache.word, normalizedWord), eq(wordCache.language, language)))
    .limit(1);

  if (cached.length > 0) {
    const entry = cached[0];
    return {
      found: true as const,
      source: "ai" as const,
      word: entry.baseForm || normalizedWord,
      translation: entry.translation,
      pos: entry.pos || null,
      gender: entry.gender || null,
      cefrLevel: entry.cefrLevel || null,
      exampleNative: entry.exampleNative || null,
      exampleEnglish: entry.exampleEnglish || null,
    };
  }

  try {
    const promptTemplate = getDefaultTemplate("word-analysis");
    const prompt = interpolateTemplate(promptTemplate, { target_language: targetLanguage, word });

    const { object: analysis } = await generateObject({
      model: getModel("gemini-2.5-flash-lite"),
      schema: wordAnalysisSchema,
      prompt,
    });

    void db
      .insert(wordCache)
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
      .onConflictDoNothing();

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
  } catch {
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

export async function lookupWord(db: Database, word: string, language: string): Promise<WordLookupResult> {
  const [entry] = await db
    .select()
    .from(dictionaryWord)
    .where(and(eq(dictionaryWord.word, word.toLowerCase()), eq(dictionaryWord.language, language)))
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

  const aiResult = await aiLookup(db, word, language);
  if (aiResult) return aiResult;

  return { found: false, word };
}
