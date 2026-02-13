/**
 * Batch pre-generate TTS audio for all exercises in the database.
 *
 * Usage:
 *   bun run scripts/generate-audio.ts
 */

import { db } from "../lib/db";
import { unit, course } from "../lib/db/schema";
import { generateSpeech } from "../lib/tts";
import type { Exercise, UnitLesson } from "../lib/content/types";

function extractTexts(
  exercise: Exercise,
  language: string
): { text: string; language: string }[] {
  const items: { text: string; language: string }[] = [];

  switch (exercise.type) {
    case "multiple-choice":
      items.push({ text: exercise.prompt, language });
      for (const choice of exercise.choices) {
        items.push({ text: choice, language });
      }
      break;
    case "translation":
      items.push({ text: exercise.sentence, language });
      // Also generate for individual words
      for (const word of exercise.sentence.split(/\s+/)) {
        const clean = word.replace(/[^\p{L}\p{M}'-]/gu, "");
        if (clean) items.push({ text: clean, language });
      }
      break;
    case "fill-in-the-blank":
      items.push({
        text: exercise.sentence.replace("___", exercise.blank),
        language,
      });
      break;
    case "listening":
      items.push({ text: exercise.text, language });
      break;
    case "word-bank":
      items.push({ text: exercise.prompt, language });
      for (const word of exercise.words) {
        items.push({ text: word, language });
      }
      break;
    case "matching-pairs":
      for (const pair of exercise.pairs) {
        items.push({ text: pair.left, language });
      }
      break;
  }

  return items;
}

async function main() {
  console.log("Loading courses and units from DB...");

  const units = await db
    .select({ exercises: unit.exercises, courseId: unit.courseId })
    .from(unit);

  const courses = await db
    .select({ id: course.id, targetLanguage: course.targetLanguage })
    .from(course);

  const courseLanguageMap = new Map(
    courses.map((c) => [c.id, c.targetLanguage])
  );

  // Collect all unique (text, language) pairs
  const seen = new Set<string>();
  const pairs: { text: string; language: string }[] = [];

  for (const u of units) {
    const language = u.courseId ? courseLanguageMap.get(u.courseId) : null;
    if (!language) continue;

    const lessons = u.exercises as UnitLesson[];
    for (const lesson of lessons) {
      for (const exercise of lesson.exercises) {
        const texts = extractTexts(exercise, language);
        for (const item of texts) {
          const key = `${item.language}:${item.text.toLowerCase()}`;
          if (!seen.has(key)) {
            seen.add(key);
            pairs.push(item);
          }
        }
      }
    }
  }

  console.log(`Found ${pairs.length} unique audio items to generate.`);

  let generated = 0;
  let skipped = 0;

  for (const { text, language } of pairs) {
    try {
      await generateSpeech(text, language);
      generated++;
      if (generated % 10 === 0) {
        console.log(
          `Progress: ${generated + skipped}/${pairs.length} (${generated} generated, ${skipped} cached)`
        );
      }
    } catch (err) {
      console.error(`Failed to generate audio for "${text}" (${language}):`, err);
    }
  }

  console.log(
    `\nDone! Generated ${generated} audio files, ${skipped} were already cached.`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
