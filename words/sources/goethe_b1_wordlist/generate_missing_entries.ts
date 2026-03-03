// bun "words/sources/goethe_b1_wordlist/generate_missing_entries.ts"

import { generateObject } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { z } from "zod";

const SCRIPT_DIR = import.meta.dir;
const MISSING_WORDS_PATH = `${SCRIPT_DIR}/missing_words_to_generate.txt`;
const GENERATED_OUTPUT_PATH = `${SCRIPT_DIR}/generated_entries.json`;
const MODEL_ID = "gemini-2.5-flash-lite";
const DEFAULT_BATCH_SIZE = 10;
const MISSING_WORD_RETRY_LIMIT = 2;

const entrySchema = z.object({
  word: z.string().min(1),
  useful_for_flashcard: z.boolean(),
  goethe_b1_wordlist: z.boolean(),
  cefr_level: z.string().min(1),
  english_translation: z.string().min(1),
  romanization: z.string().min(1),
  example_sentence_native: z.string().min(1),
  example_sentence_english: z.string().min(1),
  gender: z.string(),
  is_separable_verb: z.boolean(),
  separable_prefix: z.string(),
  base_verb: z.string(),
  capitalization_sensitive: z.boolean(),
  pos: z.string().min(1),
});

type DictionaryEntry = z.infer<typeof entrySchema>;

const existingEntrySchema = entrySchema.extend({
  goethe_b1_wordlist: z.boolean().optional(),
});

type PendingLine = {
  lineIndex: number;
  originalLine: string;
  baseWord: string;
  normalizedWord: string;
};

function normalizeWord(word: string): string {
  return word.trim().toLowerCase();
}

function canonicalWord(word: string): string {
  return normalizeWord(word)
    .replace(/ß/g, "ss")
    .replace(/[–—-]/g, "")
    .replace(/\s+/g, " ")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "");
}

function hasGeneratedMarker(line: string): boolean {
  return /\[generated\]/i.test(line);
}

function stripMarkers(line: string): string {
  return line
    .replace(/\s*\[(generated|repeated)\]\s*/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collectPendingLines(lines: string[]): PendingLine[] {
  const pending: PendingLine[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().length === 0) continue;
    if (hasGeneratedMarker(line)) continue;

    const baseWord = stripMarkers(line);
    if (!baseWord) continue;

    pending.push({
      lineIndex: i,
      originalLine: line,
      baseWord,
      normalizedWord: normalizeWord(baseWord),
    });
  }

  return pending;
}

function toPromptWords(selected: PendingLine[]): string[] {
  const unique = new Map<string, string>();
  for (const item of selected) {
    if (!unique.has(item.normalizedWord)) {
      unique.set(item.normalizedWord, item.baseWord);
    }
  }
  return Array.from(unique.values());
}

function buildPrompt(words: string[]): string {
  const wordsList = words.map((w, idx) => `${idx + 1}. ${w}`).join("\n");
  return `You are creating German dictionary entries for a CEFR B1 learner.

Return ONLY JSON with this exact top-level shape:
{
  "entries": [ ... ]
}

Each object inside "entries" must correspond to one input word and include EXACTLY these keys:
- word (string)
- useful_for_flashcard (boolean)
- goethe_b1_wordlist (boolean, always true)
- cefr_level (string, always "B1")
- english_translation (string)
- romanization (string)
- example_sentence_native (string, German sentence using the word)
- example_sentence_english (string, English translation of the sentence)
- gender (string, use "", "masculine", "feminine", or "neuter" as appropriate)
- is_separable_verb (boolean)
- separable_prefix (string; empty when not separable)
- base_verb (string; empty when not a verb or already base form)
- capitalization_sensitive (boolean)
- pos (string; e.g. noun, verb, adjective, adverb, preposition, conjunction, pronoun, article, interjection, numeral)

Hard requirements:
- Generate one entry per input word.
- Keep "word" aligned with the input lexical item (no unrelated substitutions).
- Set cefr_level to "B1" for all entries.
- Do not include word_frequency.
- Do not include any extra keys.

Input words:
${wordsList}`;
}

function normalizeEntry(entry: DictionaryEntry): DictionaryEntry {
  return {
    ...entry,
    word: entry.word.trim(),
    goethe_b1_wordlist: true,
    cefr_level: "B1",
    pos: entry.pos.trim().toLowerCase(),
    gender: entry.gender.trim(),
    separable_prefix: entry.separable_prefix.trim(),
    base_verb: entry.base_verb.trim(),
    romanization: entry.romanization.trim(),
    english_translation: entry.english_translation.trim(),
    example_sentence_native: entry.example_sentence_native.trim(),
    example_sentence_english: entry.example_sentence_english.trim(),
  };
}

function validateBatchCoverage(
  entries: DictionaryEntry[],
  requestedWords: string[],
) {
  const requestedSet = new Set(requestedWords.map(canonicalWord));
  const entrySet = new Set(entries.map((e) => canonicalWord(e.word)));

  for (const requestedWord of requestedSet) {
    if (!entrySet.has(requestedWord)) {
      throw new Error(
        `Model output missing entry for requested word: ${requestedWord}`,
      );
    }
  }

  for (const generatedWord of entrySet) {
    if (!requestedSet.has(generatedWord)) {
      throw new Error(
        `Model output contains unexpected word: ${generatedWord}`,
      );
    }
  }
}

async function generateForWords(
  google: ReturnType<typeof createGoogleGenerativeAI>,
  schema: z.ZodType<{ entries: DictionaryEntry[] }>,
  words: string[],
): Promise<DictionaryEntry[]> {
  const prompt = buildPrompt(words);
  const { object } = await generateObject({
    model: google(MODEL_ID),
    schema,
    prompt,
  });
  return object.entries.map(normalizeEntry);
}

function reconcileEntriesToRequested(
  requestedWords: string[],
  generatedEntries: DictionaryEntry[],
): { alignedEntries: DictionaryEntry[]; missingWords: string[] } {
  const availableByCanonical = new Map<string, DictionaryEntry[]>();
  for (const entry of generatedEntries) {
    const key = canonicalWord(entry.word);
    const bucket = availableByCanonical.get(key);
    if (bucket) {
      bucket.push(entry);
    } else {
      availableByCanonical.set(key, [entry]);
    }
  }

  const alignedEntries: DictionaryEntry[] = [];
  const missingWords: string[] = [];
  const extras: DictionaryEntry[] = [];

  for (const requestedWord of requestedWords) {
    const key = canonicalWord(requestedWord);
    const bucket = availableByCanonical.get(key);
    if (!bucket || bucket.length === 0) {
      missingWords.push(requestedWord);
      continue;
    }
    const match = bucket.shift();
    if (match) {
      // Keep generated lexical data, but force exact requested surface form.
      alignedEntries.push({ ...match, word: requestedWord });
    }
  }

  for (const bucket of availableByCanonical.values()) {
    for (const entry of bucket) extras.push(entry);
  }

  // If the model returned same-count entries but with unexpected forms,
  // reuse those entries for still-missing requested words.
  for (const requestedWord of [...missingWords]) {
    if (extras.length === 0) break;
    const extra = extras.shift();
    if (!extra) break;
    alignedEntries.push({ ...extra, word: requestedWord });
    const idx = missingWords.indexOf(requestedWord);
    if (idx >= 0) missingWords.splice(idx, 1);
  }

  return { alignedEntries, missingWords };
}

async function readExistingGeneratedEntries(): Promise<DictionaryEntry[]> {
  const outputFile = Bun.file(GENERATED_OUTPUT_PATH);
  if (!(await outputFile.exists())) {
    return [];
  }

  const existingText = await outputFile.text();
  if (existingText.trim().length === 0) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(existingText);
  } catch (error) {
    throw new Error(
      `Could not parse existing ${GENERATED_OUTPUT_PATH} as JSON: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const parsedEntries = z.array(existingEntrySchema).safeParse(parsed);
  if (!parsedEntries.success) {
    throw new Error(
      `Existing ${GENERATED_OUTPUT_PATH} does not match expected entry schema`,
    );
  }

  return parsedEntries.data.map((entry) =>
    normalizeEntry({
      ...entry,
      goethe_b1_wordlist: entry.goethe_b1_wordlist ?? true,
    }),
  );
}

async function main() {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GOOGLE_AI_API_KEY environment variable");
  }

  const batchSizeArg = process.argv[2];
  const batchSize =
    batchSizeArg &&
    Number.isFinite(Number(batchSizeArg)) &&
    Number(batchSizeArg) > 0
      ? Math.floor(Number(batchSizeArg))
      : DEFAULT_BATCH_SIZE;

  const missingWordsText = await Bun.file(MISSING_WORDS_PATH).text();
  const lines = missingWordsText.split("\n");
  const google = createGoogleGenerativeAI({ apiKey });
  const schema = z.object({
    entries: z.array(entrySchema),
  });
  const existingEntries = await readExistingGeneratedEntries();
  const existingWords = new Set(
    existingEntries.map((e) => normalizeWord(e.word)),
  );

  let batchCount = 0;
  let totalRequestedLines = 0;
  let totalGeneratedEntries = 0;
  let totalAppendedEntries = 0;
  let totalMarkedLines = 0;

  while (true) {
    const pending = collectPendingLines(lines);
    const selected = pending.slice(0, batchSize);
    if (selected.length === 0) {
      break;
    }

    batchCount++;
    totalRequestedLines += selected.length;

    const promptWords = toPromptWords(selected);
    let generatedEntries = await generateForWords(google, schema, promptWords);
    let reconciliation = reconcileEntriesToRequested(promptWords, generatedEntries);
    let missingWords = reconciliation.missingWords;

    for (
      let attempt = 1;
      attempt <= MISSING_WORD_RETRY_LIMIT && missingWords.length > 0;
      attempt++
    ) {
      const retryEntries = await generateForWords(google, schema, missingWords);
      const mergedEntries = reconciliation.alignedEntries.concat(retryEntries);
      reconciliation = reconcileEntriesToRequested(promptWords, mergedEntries);
      missingWords = reconciliation.missingWords;
      if (missingWords.length > 0) {
        console.warn(
          `Batch ${batchCount} retry ${attempt}: still missing ${missingWords.join(", ")}`,
        );
      }
    }

    if (missingWords.length > 0) {
      throw new Error(
        `Model could not produce entries for words after retries: ${missingWords.join(", ")}`,
      );
    }

    generatedEntries = reconciliation.alignedEntries;
    validateBatchCoverage(generatedEntries, promptWords);
    totalGeneratedEntries += generatedEntries.length;

    let appendedCount = 0;
    for (const entry of generatedEntries) {
      const normalized = normalizeWord(entry.word);
      if (existingWords.has(normalized)) continue;
      existingEntries.push(entry);
      existingWords.add(normalized);
      appendedCount++;
    }
    totalAppendedEntries += appendedCount;

    await Bun.write(
      GENERATED_OUTPUT_PATH,
      `${JSON.stringify(existingEntries, null, 2)}\n`,
    );

    let markedCount = 0;
    for (const item of selected) {
      if (hasGeneratedMarker(lines[item.lineIndex])) continue;
      lines[item.lineIndex] = `${item.originalLine.trimEnd()} [generated]`;
      markedCount++;
    }
    totalMarkedLines += markedCount;

    await Bun.write(MISSING_WORDS_PATH, lines.join("\n"));

    console.log(
      [
        `Batch ${batchCount}`,
        `Requested lines: ${selected.length}`,
        `Unique prompt words: ${promptWords.length}`,
        `Generated entries: ${generatedEntries.length}`,
        `Appended entries: ${appendedCount}`,
        `Marked lines: ${markedCount}`,
      ].join(" | "),
    );
  }

  if (batchCount === 0) {
    console.log("No pending words left. Nothing to generate.");
    return;
  }

  console.log(
    [
      `Model: ${MODEL_ID}`,
      `Batches run: ${batchCount}`,
      `Requested lines: ${totalRequestedLines}`,
      `Generated entries: ${totalGeneratedEntries}`,
      `Appended entries: ${totalAppendedEntries}`,
      `Marked lines: ${totalMarkedLines}`,
      `Output: ${GENERATED_OUTPUT_PATH}`,
    ].join(" | "),
  );
}

main().catch((error) => {
  const message =
    error instanceof Error ? (error.stack ?? error.message) : String(error);
  console.error(`Failed to generate missing entries: ${message}`);
  process.exit(1);
});
