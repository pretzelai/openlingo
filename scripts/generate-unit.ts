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
  return `You are a curriculum designer for a Duolingo-style German learning app. The learners are English speakers learning B1 level German.

Generate a complete unit that teaches German vocabulary and grammar through the topic: "${topic}"

The unit must have exactly ${lessons} lessons (sections). Each lesson teaches 4-6 new German words/phrases related to the topic.

Do not ask questions that requiere knowledge about the topic like when was someone born or when did something happen. The questions should be about the vocabulary and grammar of the lesson.

Output a single markdown file in EXACTLY this format (no deviations):

The first matching pairs exercise should introduce the 4-6 new German words/phrases of B1 level. The rest of the words in the lesson should be A1/A2 level.

---
title: "<Unit Title in German>"
description: "<1-line English description of what this unit teaches>"
order: 99
icon: "<single emoji>"
color: "<hex color>"
---

## <Lesson 1 Title in German>

[matching-pairs]
- "<German word 1>" = "<English meaning 1>"
- "<German word 2>" = "<English meaning 2>"
- "<German word 3>" = "<English meaning 3>"
- "<German word 4>" = "<English meaning 4>"

---

[multiple-choice]
prompt: "<question about a German word/phrase>"
choices:
  - "<correct answer>" (correct)
  - "<wrong answer>"
  - "<wrong answer>"

---

[multiple-choice]
prompt: "<question about another German word/phrase>"
choices:
  - "<correct answer>" (correct)
  - "<wrong answer>"
  - "<wrong answer>"

---

[word-bank]
prompt: "<Sentence in English>"
words: ["<word1>", "<word2>", "<word3>", "<word4>", "<word5>", "<distractor>"]
answer: ["<word1>", "<word2>", "<word3>", "<word4>", "<word5>"]

---

[listening]
text: "<A German sentence using vocabulary from this lesson>"
ttsLang: "de"
mode: word-bank

## <Lesson 2 Title in German>

... (same pattern)`;
}

// ---------------------------------------------------------------------------
// Provider → model mapping
// ---------------------------------------------------------------------------

const providerModels: Record<string, string> = {
  google: "gemini-2.5-flash",
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
  const lessonCount = (cleaned.match(/^## /gm) || []).length;
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
