import fs from "fs";
import path from "path";
import matter from "gray-matter";
import type {
  Course,
  Unit,
  Lesson,
  Exercise,
  MultipleChoiceExercise,
  TranslationExercise,
  FillInTheBlankExercise,
  MatchingPairsExercise,
  ListeningExercise,
  WordBankExercise,
} from "./types";

const CONTENT_DIR = path.join(process.cwd(), "content");

export function loadCourse(courseDir: string): Course {
  const coursePath = path.join(CONTENT_DIR, courseDir);
  const courseFile = fs.readFileSync(
    path.join(coursePath, "course.md"),
    "utf-8"
  );
  const { data: courseMeta } = matter(courseFile);

  const unitDirs = fs
    .readdirSync(coursePath)
    .filter((f) => f.startsWith("unit-") && fs.statSync(path.join(coursePath, f)).isDirectory())
    .sort();

  const units = unitDirs.map((unitDir) => loadUnit(path.join(coursePath, unitDir)));

  return {
    id: courseMeta.id,
    title: courseMeta.title,
    sourceLanguage: courseMeta.sourceLanguage,
    targetLanguage: courseMeta.targetLanguage,
    level: courseMeta.level,
    units,
  };
}

function loadUnit(unitPath: string): Unit {
  const unitFile = fs.readFileSync(path.join(unitPath, "unit.md"), "utf-8");
  const { data: unitMeta } = matter(unitFile);

  const lessonFiles = fs
    .readdirSync(unitPath)
    .filter((f) => f.startsWith("lesson-") && f.endsWith(".md"))
    .sort();

  const lessons = lessonFiles.map((file) =>
    loadLesson(path.join(unitPath, file))
  );

  return {
    title: unitMeta.title,
    description: unitMeta.description,
    order: unitMeta.order,
    icon: unitMeta.icon,
    color: unitMeta.color,
    lessons,
  };
}

function loadLesson(lessonPath: string): Lesson {
  const raw = fs.readFileSync(lessonPath, "utf-8");
  const { data: meta, content } = matter(raw);

  const exerciseBlocks = content
    .split(/\n---\n/)
    .map((b) => b.trim())
    .filter(Boolean);

  const exercises = exerciseBlocks.map(parseExercise);

  return {
    title: meta.title,
    order: meta.order,
    xpReward: meta.xpReward,
    exercises,
  };
}

function parseExercise(block: string): Exercise {
  const typeMatch = block.match(/^\[(.+?)\]/);
  if (!typeMatch) throw new Error(`No exercise type found in block: ${block}`);
  const type = typeMatch[1];
  const lines = block
    .slice(typeMatch[0].length)
    .trim()
    .split("\n")
    .map((l) => l.trim());

  switch (type) {
    case "multiple-choice":
      return parseMultipleChoice(lines);
    case "translation":
      return parseTranslation(lines);
    case "fill-in-the-blank":
      return parseFillInTheBlank(lines);
    case "matching-pairs":
      return parseMatchingPairs(lines);
    case "listening":
      return parseListening(lines);
    case "word-bank":
      return parseWordBank(lines);
    default:
      throw new Error(`Unknown exercise type: ${type}`);
  }
}

function getField(lines: string[], key: string): string {
  const line = lines.find((l) => l.startsWith(`${key}:`));
  if (!line) throw new Error(`Missing field: ${key}`);
  return line.slice(key.length + 1).trim().replace(/^"(.*)"$/, "$1");
}

function parseMultipleChoice(lines: string[]): MultipleChoiceExercise {
  const prompt = getField(lines, "prompt");
  const choiceLines = lines.filter((l) => l.startsWith('- "'));
  const choices: string[] = [];
  let correctIndex = 0;

  choiceLines.forEach((line, i) => {
    const match = line.match(/^- "(.+?)"\s*(\(correct\))?/);
    if (match) {
      choices.push(match[1]);
      if (match[2]) correctIndex = i;
    }
  });

  return { type: "multiple-choice", prompt, choices, correctIndex };
}

function parseTranslation(lines: string[]): TranslationExercise {
  const prompt = getField(lines, "prompt");
  const sentence = getField(lines, "sentence");
  const answer = getField(lines, "answer");
  const acceptAlsoLine = lines.find((l) => l.startsWith("acceptAlso:"));
  const acceptAlso: string[] = [];
  if (acceptAlsoLine) {
    const matches = acceptAlsoLine.match(/"([^"]+)"/g);
    if (matches) acceptAlso.push(...matches.map((m) => m.replace(/"/g, "")));
  }

  return { type: "translation", prompt, sentence, answer, acceptAlso };
}

function parseFillInTheBlank(lines: string[]): FillInTheBlankExercise {
  const sentence = getField(lines, "sentence");
  const blank = getField(lines, "blank");
  return { type: "fill-in-the-blank", sentence, blank };
}

function parseMatchingPairs(lines: string[]): MatchingPairsExercise {
  const pairLines = lines.filter((l) => l.startsWith("- "));
  const pairs = pairLines.map((l) => {
    const match = l.match(/^- "(.+?)"\s*=\s*"(.+?)"/);
    if (!match) throw new Error(`Invalid pair: ${l}`);
    return { left: match[1], right: match[2] };
  });
  return { type: "matching-pairs", pairs };
}

function parseListening(lines: string[]): ListeningExercise {
  const text = getField(lines, "text");
  const ttsLang = getField(lines, "ttsLang");
  return { type: "listening", text, ttsLang };
}

function parseWordBank(lines: string[]): WordBankExercise {
  const prompt = getField(lines, "prompt");
  const wordsLine = lines.find((l) => l.startsWith("words:"));
  const answerLine = lines.find((l) => l.startsWith("answer:"));
  const words = wordsLine
    ? (wordsLine.match(/"([^"]+)"/g) || []).map((m) => m.replace(/"/g, ""))
    : [];
  const answer = answerLine
    ? (answerLine.match(/"([^"]+)"/g) || []).map((m) => m.replace(/"/g, ""))
    : [];
  return { type: "word-bank", prompt, words, answer };
}
