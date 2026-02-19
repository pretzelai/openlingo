/**
 * Generate a self-contained unit markdown file using AI.
 *
 * Usage:
 *   bun run scripts/generate-unit.ts --provider google --topic "Albert Einstein"
 *   bun run scripts/generate-unit.ts --provider openai --topic "Die Berliner Mauer"
 *   bun run scripts/generate-unit.ts --provider anthropic --topic "Wolfgang Amadeus Mozart"
 *   bun run scripts/generate-unit.ts --provider google --topic "Albert Einstein" --lessons 6
 *
 * API keys are read from .env.local (auto-injected by bun):
 *   GOOGLE_AI_API_KEY, OPENAI_API_KEY, ANTHROPIC_API_KEY
 */

import fs from "fs";
import path from "path";
import { generateText } from "ai";
import { getModel } from "../lib/ai/models";
import {
  getDefaultTemplate,
  interpolateTemplate,
  langCodeToName,
} from "../lib/prompts";
import { EXERCISE_SYNTAX } from "../lib/content/exercise-syntax";

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
function parseArgs() {
  const args = process.argv.slice(2);
  let provider = "google";
  let topic = "";
  let lessons = 10;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--provider" && args[i + 1]) provider = args[++i];
    else if (args[i] === "--topic" && args[i + 1]) topic = args[++i];
    else if (args[i] === "--lessons" && args[i + 1])
      lessons = parseInt(args[++i], 10);
  }

  if (!topic) {
    console.error(
      "Usage: bun run scripts/generate-unit.ts --provider <google|openai|anthropic> --topic <topic> [--lessons <n>]",
    );
    process.exit(1);
  }

  return { provider, topic, lessons };
}

// ---------------------------------------------------------------------------
// Prompt
// ---------------------------------------------------------------------------
function buildPrompt(topic: string, lessons: number): string {
  const template = `You are a curriculum designer for a language learning app. The learners are English speakers learning {langName} at {level} level.

Generate a complete unit that teaches {langName} vocabulary and grammar through the topic: "{topic}"

The unit must have exactly {lessons} lessons. Each lesson teaches 4-6 new words/phrases related to the topic. Each lesson should have 3-5 varied exercises.

Do not ask questions that require knowledge about the topic like when was someone born or when did something happen. The questions should be about the vocabulary and grammar of the lesson.

Exercises should progress from easier to harder within each lesson. The first exercise in each lesson should be a matching-pairs exercise introducing the new vocabulary.

Output a single markdown file with YAML frontmatter followed by lesson sections. Each lesson is defined by a --- delimited metadata block. Here is the exact format:

---
unitTitle: "<Unit Title in {langName}>"
description: "<1-line English description of what this unit teaches>"
icon: "<single emoji>"
color: "<hex color>"
targetLanguage: "{langCode}"
sourceLanguage: "en"
level: "{level}"
---

---
lessonTitle: "<Lesson 1 Title in {langName}>"
description: "<1-line description>"
icon: "<emoji>"
color: "<hex color>"
---

<exercises for lesson 1>

---
lessonTitle: "<Lesson 2 Title in {langName}>"
description: "<1-line description>"
icon: "<emoji>"
color: "<hex color>"
---

<exercises for lesson 2>

(... continue for all {lessons} lessons)

IMPORTANT: Use the ttsLang value "{langCode}" for all listening exercises.

Below is the complete exercise syntax reference. Follow it EXACTLY — the output will be machine-parsed:

<exercise-syntax>
{exerciseReference}
</exercise-syntax>`;
  return interpolateTemplate(template, {
    topic,
    lessons: String(lessons),
    langName: "German",
    level: "B1",
    langCode: "de",
    exerciseReference: EXERCISE_SYNTAX,
  });
}

// ---------------------------------------------------------------------------
// Provider → model mapping
// ---------------------------------------------------------------------------

const providerModels: Record<string, string> = {
  google: "gemini-3-flash-preview",
  openai: "gpt-4o",
  anthropic: "claude-sonnet-4-5-20250929",
};

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { provider, topic, lessons } = parseArgs();

  const modelName = providerModels[provider];
  if (!modelName) {
    console.error(
      `Unknown provider: ${provider}. Use: google, openai, anthropic`,
    );
    process.exit(1);
  }

  const prompt = buildPrompt(topic, lessons);

  console.log(
    `Generating unit for "${topic}" using ${provider} (${lessons} lessons)...`,
  );

  const { text: markdown } = await generateText({
    model: getModel(modelName),
    prompt,
  });

  // Clean up: remove code fences if the model wrapped it
  const cleaned = markdown
    .replace(/^```(?:markdown|md)?\n/m, "")
    .replace(/\n```\s*$/, "")
    .trim();

  // Derive filename from topic
  const slug = topic
    .toLowerCase()
    .replace(/[^a-z0-9äöüß]+/g, "-")
    .replace(/^-|-$/g, "");
  const outDir = path.join(process.cwd(), "content", "german");
  const outFile = path.join(outDir, `unit-${slug}.md`);

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(outFile, cleaned + "\n", "utf-8");

  console.log(`\nDone! Written to: ${outFile}`);

  // Quick stats
  const lessonCount = (cleaned.match(/^lessonTitle:/gm) || []).length;
  const exerciseCount = (
    cleaned.match(
      /^\[(?:multiple-choice|fill-in-the-blank|matching-pairs|word-bank|listening|translation)\]/gm,
    ) || []
  ).length;
  console.log(`  Lessons: ${lessonCount}, Exercises: ${exerciseCount}`);
}

main().catch((err) => {
  console.error("Error:", err.message || err);
  process.exit(1);
});
