import type {
  Exercise,
  MultipleChoiceExercise,
  TranslationExercise,
  FillInTheBlankExercise,
  MatchingPairsExercise,
  ListeningExercise,
  WordBankExercise,
  SpeakingExercise,
} from "./types";

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
    case "speaking":
      return parseSpeaking(lines);
    default:
      throw new Error(`Unknown exercise type: ${type}`);
  }
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

function parseMultipleChoice(lines: string[]): MultipleChoiceExercise {
  const noAudio: string[] = [];
  const rawPrompt = stripNoAudio(getField(lines, "prompt"));
  if (rawPrompt.flagged) noAudio.push("prompt");

  const choiceLines = lines.filter((l) => l.startsWith('- "'));
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
  return { type: "multiple-choice", prompt: rawPrompt.text, choices, correctIndex, ...(randomOrder && { randomOrder }), ...(noAudio.length && { noAudio }) };
}

function parseTranslation(lines: string[]): TranslationExercise {
  const noAudio: string[] = [];
  const rawPrompt = stripNoAudio(getField(lines, "prompt"));
  if (rawPrompt.flagged) noAudio.push("prompt");
  const rawSentence = stripNoAudio(getField(lines, "sentence"));
  if (rawSentence.flagged) noAudio.push("sentence");

  const answer = getField(lines, "answer");
  const acceptAlsoLine = lines.find((l) => l.startsWith("acceptAlso:"));
  const acceptAlso: string[] = [];
  if (acceptAlsoLine) {
    const matches = acceptAlsoLine.match(/"([^"]+)"/g);
    if (matches) acceptAlso.push(...matches.map((m) => m.replace(/"/g, "")));
  }

  return { type: "translation", prompt: rawPrompt.text, sentence: rawSentence.text, answer, acceptAlso, ...(noAudio.length && { noAudio }) };
}

function parseFillInTheBlank(lines: string[]): FillInTheBlankExercise {
  const noAudio: string[] = [];
  const rawSentence = stripNoAudio(getField(lines, "sentence"));
  if (rawSentence.flagged) noAudio.push("sentence");
  const blank = getField(lines, "blank");
  return { type: "fill-in-the-blank", sentence: rawSentence.text, blank, ...(noAudio.length && { noAudio }) };
}

function parseMatchingPairs(lines: string[]): MatchingPairsExercise {
  const noAudio: string[] = [];
  const pairLines = lines.filter((l) => l.startsWith("- "));
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
  return { type: "matching-pairs", pairs, ...(randomOrder && { randomOrder }), ...(noAudio.length && { noAudio }) };
}

function parseListening(lines: string[]): ListeningExercise {
  const noAudio: string[] = [];
  const rawText = stripNoAudio(getField(lines, "text"));
  if (rawText.flagged) noAudio.push("text");
  const ttsLang = getField(lines, "ttsLang");
  const mode = getOptionalField(lines, "mode") as "choices" | "word-bank" | undefined;
  return { type: "listening", text: rawText.text, ttsLang, ...(mode && { mode }), ...(noAudio.length && { noAudio }) };
}

function parseSpeaking(lines: string[]): SpeakingExercise {
  const noAudio: string[] = [];
  const rawSentence = stripNoAudio(getField(lines, "sentence"));
  if (rawSentence.flagged) noAudio.push("sentence");
  return { type: "speaking", sentence: rawSentence.text, ...(noAudio.length && { noAudio }) };
}

function parseWordBank(lines: string[]): WordBankExercise {
  const noAudio: string[] = [];
  const rawPrompt = stripNoAudio(getField(lines, "prompt"));
  if (rawPrompt.flagged) noAudio.push("prompt");
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
  return { type: "word-bank", prompt: rawPrompt.text, words, answer, ...(randomOrder && { randomOrder }), ...(noAudio.length && { noAudio }) };
}
