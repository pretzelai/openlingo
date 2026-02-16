import type { Exercise } from "@/lib/content/types";

/**
 * Extract SRS words from an exercise.
 * - matching-pairs: infers from pairs (left = target word, right = translation)
 * - All types: appends exercise.srsWords if present
 * Returns deduplicated list.
 */
export function extractSrsWords(
  exercise: Exercise
): { word: string; translation: string }[] {
  const seen = new Map<string, string>();

  // Infer from matching-pairs
  if (exercise.type === "matching-pairs") {
    for (const pair of exercise.pairs) {
      const key = pair.left.toLowerCase();
      if (!seen.has(key)) seen.set(key, pair.right);
    }
  }

  // Append explicit srsWords
  if (exercise.srsWords) {
    for (const w of exercise.srsWords) {
      const key = w.word.toLowerCase();
      if (!seen.has(key)) seen.set(key, w.translation);
    }
  }

  return Array.from(seen.entries()).map(([word, translation]) => ({
    word,
    translation,
  }));
}
