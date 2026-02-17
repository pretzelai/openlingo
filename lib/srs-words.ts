import type { Exercise } from "@/lib/content/types";

/**
 * Extract SRS words (target-language) from an exercise as a flat string array.
 */
export function extractSrsWords(exercise: Exercise): string[] {
  if (!exercise.srsWords) return [];

  const words = typeof exercise.srsWords === "string"
    ? [exercise.srsWords]
    : exercise.srsWords;

  return words
    .map((w) => w.toLowerCase())
    .filter((w, i, arr) => w && arr.indexOf(w) === i);
}
