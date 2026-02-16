import type {
  Exercise,
  MultipleChoiceExercise,
  TranslationExercise,
  FillInTheBlankExercise,
  MatchingPairsExercise,
  ListeningExercise,
  WordBankExercise,
  SpeakingExercise,
  FreeTextExercise,
} from "./types";
import { exerciseSchema } from "./exercise-schema";

/**
 * Parse raw markdown content (after frontmatter) into Exercise[].
 * Strips // comments, splits on [type-tag] boundaries, and parses each block.
 * `---` separators between exercises are optional and ignored.
 */
export function parseExercisesFromMarkdown(content: string): Exercise[] {
  const lines = content
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line));

  const blocks: string[] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (/^\[.+?\]\s*$/.test(line.trim())) {
      if (current.length > 0) {
        blocks.push(current.join("\n").trim());
      }
      current = [line];
    } else if (/^\s*---\s*$/.test(line)) {
      // skip separator lines
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) {
    blocks.push(current.join("\n").trim());
  }

  return blocks.filter(Boolean).map(parseExercise);
}

export function parseExercise(block: string): Exercise {
  const typeMatch = block.match(/^\[(.+?)\]/);
  if (!typeMatch) throw new Error(`No exercise type found in block: ${block}`);
  const type = typeMatch[1];
  const lines = block
    .slice(typeMatch[0].length)
    .trim()
    .split("\n")
    .map((l) => l.trim());

  let exercise: Exercise;
  switch (type) {
    case "multiple-choice":
      exercise = parseMultipleChoice(lines);
      break;
    case "translation":
      exercise = parseTranslation(lines);
      break;
    case "fill-in-the-blank":
      exercise = parseFillInTheBlank(lines);
      break;
    case "matching-pairs":
      exercise = parseMatchingPairs(lines);
      break;
    case "listening":
      exercise = parseListening(lines);
      break;
    case "word-bank":
      exercise = parseWordBank(lines);
      break;
    case "speaking":
      exercise = parseSpeaking(lines);
      break;
    case "free-text":
      exercise = parseFreeText(lines);
      break;
    default:
      throw new Error(`Unknown exercise type: ${type}`);
  }

  return validateExercise(exercise);
}

/**
 * Validate a parsed exercise against the Zod schema.
 * Throws a descriptive error that AI can read and fix.
 */
function validateExercise(exercise: Exercise): Exercise {
  const result = exerciseSchema.safeParse(exercise);
  if (result.success) return result.data;

  const issues = result.error.issues.map((issue) => {
    const path = issue.path.length > 0 ? issue.path.join(".") : "(root)";
    return `  - ${path}: ${issue.message}`;
  });

  throw new Error(
    `Invalid [${exercise.type}] exercise:\n${issues.join("\n")}\n` +
    `Parsed data: ${JSON.stringify(exercise, null, 2)}`
  );
}

const NO_AUDIO_RE = /\s*\[no-audio\]\s*$/;

export function stripNoAudio(text: string): { text: string; flagged: boolean } {
  if (NO_AUDIO_RE.test(text)) {
    return { text: text.replace(NO_AUDIO_RE, "").trim().replace(/^"(.*)"$/, "$1"), flagged: true };
  }
  return { text, flagged: false };
}

export function getField(lines: string[], key: string): string {
  const line = lines.find((l) => l.startsWith(`${key}:`));
  if (!line) throw new Error(`Missing field: ${key}`);
  return line.slice(key.length + 1).trim().replace(/^"(.*)"$/, "$1");
}

export function hasFlag(lines: string[], key: string): boolean {
  const line = lines.find((l) => l.startsWith(`${key}:`));
  if (!line) return false;
  return line.slice(key.length + 1).trim() === "true";
}

export function getOptionalField(lines: string[], key: string): string | undefined {
  const line = lines.find((l) => l.startsWith(`${key}:`));
  if (!line) return undefined;
  return line.slice(key.length + 1).trim().replace(/^"(.*)"$/, "$1");
}

function parseSrsWords(lines: string[]): { word: string; translation: string }[] | undefined {
  const startIdx = lines.findIndex((l) => l.startsWith("srsWords:"));
  if (startIdx === -1) return undefined;
  const words: { word: string; translation: string }[] = [];
  for (let i = startIdx + 1; i < lines.length; i++) {
    const match = lines[i].match(/^- "(.+?)"\s*=\s*"(.+?)"/);
    if (!match) break;
    words.push({ word: match[1], translation: match[2] });
  }
  return words.length > 0 ? words : undefined;
}

function parseMultipleChoice(lines: string[]): MultipleChoiceExercise {
  const noAudio: string[] = [];
  const rawText = stripNoAudio(getField(lines, "text"));
  if (rawText.flagged) noAudio.push("text");

  const mcSrsIdx = lines.findIndex((l) => l.startsWith("srsWords:"));
  const choiceLines = lines.filter((l, i) => l.startsWith('- "') && (mcSrsIdx === -1 || i < mcSrsIdx));
  const choices: string[] = [];
  let correctIndex = 0;

  choiceLines.forEach((line, i) => {
    const match = line.match(/^- "(.+?)"\s*(\(correct\))?/);
    if (match) {
      const c = stripNoAudio(match[1]);
      choices.push(c.text);
      if (c.flagged) noAudio.push(`choice:${i}`);
      if (match[2]) correctIndex = i;
    }
  });

  const randomOrder = hasFlag(lines, "random_order");
  const srsWords = parseSrsWords(lines);
  return { type: "multiple-choice", text: rawText.text, choices, correctIndex, ...(randomOrder && { randomOrder }), ...(noAudio.length && { noAudio }), ...(srsWords && { srsWords }) };
}

function parseTranslation(lines: string[]): TranslationExercise {
  const noAudio: string[] = [];
  const rawText = stripNoAudio(getField(lines, "text"));
  if (rawText.flagged) noAudio.push("text");
  const rawSentence = stripNoAudio(getField(lines, "sentence"));
  if (rawSentence.flagged) noAudio.push("sentence");

  const answer = getField(lines, "answer");
  const acceptAlsoLine = lines.find((l) => l.startsWith("acceptAlso:"));
  const acceptAlso: string[] = [];
  if (acceptAlsoLine) {
    const matches = acceptAlsoLine.match(/"([^"]+)"/g);
    if (matches) acceptAlso.push(...matches.map((m) => m.replace(/"/g, "")));
  }

  const srsWords = parseSrsWords(lines);
  return { type: "translation", text: rawText.text, sentence: rawSentence.text, answer, acceptAlso, ...(noAudio.length && { noAudio }), ...(srsWords && { srsWords }) };
}

function parseFillInTheBlank(lines: string[]): FillInTheBlankExercise {
  const noAudio: string[] = [];
  const rawSentence = stripNoAudio(getField(lines, "sentence"));
  if (rawSentence.flagged) noAudio.push("sentence");
  const blank = getField(lines, "blank");
  const srsWords = parseSrsWords(lines);
  return { type: "fill-in-the-blank", sentence: rawSentence.text, blank, ...(noAudio.length && { noAudio }), ...(srsWords && { srsWords }) };
}

function parseMatchingPairs(lines: string[]): MatchingPairsExercise {
  const noAudio: string[] = [];
  const srsIdx = lines.findIndex((l) => l.startsWith("srsWords:"));
  const pairLines = lines.filter((l, i) => l.startsWith("- ") && (srsIdx === -1 || i < srsIdx));
  const pairs = pairLines.map((l, i) => {
    const match = l.match(/^- "(.+?)"\s*=\s*"(.+?)"/);
    if (!match) throw new Error(`Invalid pair: ${l}`);
    const left = stripNoAudio(match[1]);
    const right = stripNoAudio(match[2]);
    if (left.flagged) noAudio.push(`left:${i}`);
    if (right.flagged) noAudio.push(`right:${i}`);
    return { left: left.text, right: right.text };
  });
  const randomOrder = hasFlag(lines, "random_order");
  const srsWords = parseSrsWords(lines);
  return { type: "matching-pairs", pairs, ...(randomOrder && { randomOrder }), ...(noAudio.length && { noAudio }), ...(srsWords && { srsWords }) };
}

function parseListening(lines: string[]): ListeningExercise {
  const noAudio: string[] = [];
  const rawText = stripNoAudio(getField(lines, "text"));
  if (rawText.flagged) noAudio.push("text");
  const ttsLang = getField(lines, "ttsLang");
  const mode = getOptionalField(lines, "mode") as "choices" | "word-bank" | undefined;
  const srsWords = parseSrsWords(lines);
  return { type: "listening", text: rawText.text, ttsLang, ...(mode && { mode }), ...(noAudio.length && { noAudio }), ...(srsWords && { srsWords }) };
}

function parseSpeaking(lines: string[]): SpeakingExercise {
  const noAudio: string[] = [];
  const rawSentence = stripNoAudio(getField(lines, "sentence"));
  if (rawSentence.flagged) noAudio.push("sentence");
  const srsWords = parseSrsWords(lines);
  return { type: "speaking", sentence: rawSentence.text, ...(noAudio.length && { noAudio }), ...(srsWords && { srsWords }) };
}

function parseFreeText(lines: string[]): FreeTextExercise {
  const noAudio: string[] = [];
  const rawText = stripNoAudio(getField(lines, "text"));
  if (rawText.flagged) noAudio.push("text");
  const afterSubmitPrompt = getField(lines, "afterSubmitPrompt");
  const srsWords = parseSrsWords(lines);
  return { type: "free-text", text: rawText.text, afterSubmitPrompt, ...(noAudio.length && { noAudio }), ...(srsWords && { srsWords }) };
}

function parseWordBank(lines: string[]): WordBankExercise {
  const noAudio: string[] = [];
  const rawText = stripNoAudio(getField(lines, "text"));
  if (rawText.flagged) noAudio.push("text");
  const wordsLine = lines.find((l) => l.startsWith("words:"));
  const answerLine = lines.find((l) => l.startsWith("answer:"));
  const words = wordsLine
    ? (wordsLine.match(/"([^"]+)"/g) || []).map((m) => {
        const w = stripNoAudio(m.replace(/"/g, ""));
        if (w.flagged) noAudio.push(`word:${w.text}`);
        return w.text;
      })
    : [];
  const answer = answerLine
    ? (answerLine.match(/"([^"]+)"/g) || []).map((m) => m.replace(/"/g, ""))
    : [];
  const randomOrder = hasFlag(lines, "random_order");
  const srsWords = parseSrsWords(lines);
  return { type: "word-bank", text: rawText.text, words, answer, ...(randomOrder && { randomOrder }), ...(noAudio.length && { noAudio }), ...(srsWords && { srsWords }) };
}
