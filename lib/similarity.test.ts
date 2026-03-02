import { describe, expect, test } from "bun:test";
import {
  checkSimilarity,
  checkBestMatch,
  type SimilarityResult,
  type SimilarityOptions,
} from "./similarity";

// ---------------------------------------------------------------------------
// Table-driven test infrastructure
// ---------------------------------------------------------------------------

/**
 * Each test case defines an input pair and what we expect from checkSimilarity.
 *
 * To add a new case: append an object to the relevant array below.
 * When a case fails, the error message will show:
 *   - The case label
 *   - The input and correct strings
 *   - The expected vs actual value for the failing field
 *   - The full actual SimilarityResult for debugging
 */
interface SimilarityTestCase {
  /** Human-readable label for the test */
  label: string;
  /** The user's input string */
  input: string;
  /** The correct answer string */
  correct: string;
  /** Optional overrides (e.g. threshold) */
  options?: SimilarityOptions;
  expected: {
    isCorrect?: boolean;
    /** Exact similarity value */
    similarity?: number;
    /** Similarity must be greater than this */
    similarityGt?: number;
    /** Similarity must be less than this */
    similarityLt?: number;
    /** Exact correctedMarkdown value */
    correctedMarkdown?: string;
  };
}

interface BestMatchTestCase {
  label: string;
  input: string;
  correctAnswers: string[];
  options?: SimilarityOptions;
  expected: {
    isCorrect?: boolean;
    similarity?: number;
    similarityGt?: number;
    similarityLt?: number;
    correctedMarkdown?: string;
  };
}

/**
 * Builds a detailed, AI-readable failure message.
 */
function failMsg(
  label: string,
  input: string,
  correct: string,
  field: string,
  expected: string,
  actual: string,
  fullResult: SimilarityResult,
): string {
  return [
    ``,
    `  Case:     "${label}"`,
    `  Input:    "${input}"`,
    `  Correct:  "${correct}"`,
    `  Field:    ${field}`,
    `  Expected: ${expected}`,
    `  Actual:   ${actual}`,
    `  Full result: ${JSON.stringify(fullResult)}`,
    ``,
  ].join("\n");
}

function assertCase(c: SimilarityTestCase, result: SimilarityResult) {
  const { expected } = c;

  if (expected.isCorrect !== undefined && result.isCorrect !== expected.isCorrect) {
    throw new Error(failMsg(c.label, c.input, c.correct, "isCorrect",
      String(expected.isCorrect), String(result.isCorrect), result));
  }

  if (expected.similarity !== undefined && result.similarity !== expected.similarity) {
    throw new Error(failMsg(c.label, c.input, c.correct, "similarity",
      String(expected.similarity), String(result.similarity), result));
  }

  if (expected.similarityGt !== undefined && !(result.similarity > expected.similarityGt)) {
    throw new Error(failMsg(c.label, c.input, c.correct, "similarity (>)",
      `> ${expected.similarityGt}`, String(result.similarity), result));
  }

  if (expected.similarityLt !== undefined && !(result.similarity < expected.similarityLt)) {
    throw new Error(failMsg(c.label, c.input, c.correct, "similarity (<)",
      `< ${expected.similarityLt}`, String(result.similarity), result));
  }

  if (expected.correctedMarkdown !== undefined && result.correctedMarkdown !== expected.correctedMarkdown) {
    throw new Error(failMsg(c.label, c.input, c.correct, "correctedMarkdown",
      JSON.stringify(expected.correctedMarkdown),
      JSON.stringify(result.correctedMarkdown), result));
  }
}

// ---------------------------------------------------------------------------
// checkSimilarity — Normalization cases
// ---------------------------------------------------------------------------

const normalizationCases: SimilarityTestCase[] = [
  {
    label: "ignores case in a sentence",
    input: "i am tired",
    correct: "I am tired",
    expected: { isCorrect: true, similarity: 1 },
  },
  {
    label: "ignores case on single word",
    input: "deutschland",
    correct: "Deutschland",
    expected: { isCorrect: true, similarity: 1 },
  },
  {
    label: "treats ß as ss",
    input: "strasse",
    correct: "Straße",
    expected: { isCorrect: true, similarity: 1 },
  },
  {
    label: "treats ss as ß",
    input: "Straße",
    correct: "Strasse",
    expected: { isCorrect: true, similarity: 1 },
  },
  {
    label: "ignores umlaut ü",
    input: "uber",
    correct: "Über",
    expected: { isCorrect: true },
  },
  {
    label: "ignores umlaut ö",
    input: "schon",
    correct: "schön",
    expected: { isCorrect: true },
  },
  {
    label: "ignores umlaut ä",
    input: "Madchen",
    correct: "Mädchen",
    expected: { isCorrect: true },
  },
  {
    label: "ignores accent é",
    input: "cafe",
    correct: "Café",
    expected: { isCorrect: true },
  },
  {
    label: "ignores accent ñ",
    input: "nino",
    correct: "Niño",
    expected: { isCorrect: true },
  },
  {
    label: "ignores accent ï",
    input: "naive",
    correct: "naïve",
    expected: { isCorrect: true },
  },
  {
    label: "ignores punctuation (comma, exclamation)",
    input: "Hello world",
    correct: "Hello, world!",
    expected: { isCorrect: true },
  },
  {
    label: "ignores punctuation in reverse direction",
    input: "Hello, world!",
    correct: "Hello world",
    expected: { isCorrect: true },
  },
  {
    label: "ignores trailing punctuation (exclamation)",
    input: "Yes",
    correct: "Yes!",
    expected: { similarity: 1 },
  },
  {
    label: "ignores Spanish inverted punctuation and accents",
    input: "Como estas?",
    correct: "¿Cómo estás?",
    expected: { isCorrect: true },
  },
  {
    label: "trims leading/trailing whitespace in input",
    input: "  hello  ",
    correct: "hello",
    expected: { isCorrect: true },
  },
  // --- New cases added for bug fixes ---
  {
    label: "trims whitespace in correct answer",
    input: "hello",
    correct: "  hello  ",
    expected: { isCorrect: true, similarity: 1 },
  },
  {
    label: "normalizes curly apostrophe (right single quote) to straight",
    input: "don\u2019t",
    correct: "don't",
    expected: { isCorrect: true, similarity: 1 },
  },
  {
    label: "normalizes curly apostrophe in correct answer",
    input: "don't",
    correct: "don\u2019t",
    expected: { isCorrect: true, similarity: 1 },
  },
  {
    label: "normalizes left single curly quote",
    input: "\u2018hello\u2019",
    correct: "'hello'",
    expected: { isCorrect: true, similarity: 1 },
  },
  {
    label: "normalizes curly double quotes",
    input: "\u201Chello\u201D",
    correct: '"hello"',
    expected: { isCorrect: true, similarity: 1 },
  },
  {
    label: "normalizes tab to space",
    input: "ich\tlerne",
    correct: "ich lerne",
    expected: { isCorrect: true, similarity: 1 },
  },
  {
    label: "normalizes newline to space",
    input: "ich\nlerne",
    correct: "ich lerne",
    expected: { isCorrect: true, similarity: 1 },
  },
  {
    label: "collapses multiple spaces",
    input: "ich   lerne",
    correct: "ich lerne",
    expected: { isCorrect: true, similarity: 1 },
  },
  {
    label: "ignores punctuation in correct answer",
    input: "ich lerne",
    correct: "ich lerne.",
    expected: { isCorrect: true, similarity: 1 },
  },
  {
    label: "ignores punctuation in correct answer 2",
    input: "ich lerne.",
    correct: "ich lerne",
    expected: { isCorrect: true, similarity: 1 },
  },
  {
    label: "ignores punctuation in correct answer 2",
    input: "hallo ich lerne",
    correct: "hallo, ich lerne",
    expected: { isCorrect: true, similarity: 1 },
  }
];

// ---------------------------------------------------------------------------
// checkSimilarity — Threshold cases
// ---------------------------------------------------------------------------

const thresholdCases: SimilarityTestCase[] = [
  {
    label: "default threshold (1) forgives one typo",
    input: "helo",
    correct: "hello",
    expected: { isCorrect: true, similarityLt: 1 },
  },
  {
    label: "default threshold rejects two typos",
    input: "hlo",
    correct: "hello",
    expected: { isCorrect: false },
  },
  {
    label: "threshold=0 requires exact match after normalization",
    input: "helo",
    correct: "hello",
    options: { threshold: 0 },
    expected: { isCorrect: false },
  },
  {
    label: "threshold=2 forgives two typos",
    input: "hlo",
    correct: "hello",
    options: { threshold: 2 },
    expected: { isCorrect: true },
  },
  // --- New: short-string threshold scaling ---
  {
    label: "single char mismatch is rejected (short string scaling)",
    input: "a",
    correct: "b",
    expected: { isCorrect: false },
  },
  {
    label: "single char exact match works",
    input: "a",
    correct: "a",
    expected: { isCorrect: true, similarity: 1 },
  },
  {
    label: "two char string allows one typo",
    input: "ab",
    correct: "ac",
    expected: { isCorrect: true },
  },
];

// ---------------------------------------------------------------------------
// checkSimilarity — Similarity score cases
// ---------------------------------------------------------------------------

const similarityCases: SimilarityTestCase[] = [
  {
    label: "exact match is 1",
    input: "hello",
    correct: "hello",
    expected: { similarity: 1 },
  },
  {
    label: "normalized match is 1",
    input: "HELLO",
    correct: "hello",
    expected: { similarity: 1 },
  },
  {
    label: "completely different strings have low similarity",
    input: "abc",
    correct: "xyz",
    expected: { similarityLt: 0.5 },
  },
  {
    label: "one char off has high similarity",
    input: "hell",
    correct: "hello",
    expected: { similarityGt: 0.7 },
  },
];

// ---------------------------------------------------------------------------
// checkSimilarity — correctedMarkdown cases
// ---------------------------------------------------------------------------

const markdownCases: SimilarityTestCase[] = [
  {
    label: "no diff on exact match",
    input: "hello",
    correct: "hello",
    expected: { correctedMarkdown: "hello" },
  },
  {
    label: "no diff on normalized match (case)",
    input: "deutschland",
    correct: "Deutschland",
    expected: { correctedMarkdown: "Deutschland" },
  },
  {
    label: "no diff on normalized match (ß/ss)",
    input: "strasse",
    correct: "Straße",
    expected: { correctedMarkdown: "Straße" },
  },
  {
    label: "no diff on normalized match (umlaut)",
    input: "uber",
    correct: "Über",
    expected: { correctedMarkdown: "Über" },
  },
  {
    label: "bolds missing character",
    input: "Deutshland",
    correct: "Deutschland",
    expected: { correctedMarkdown: "Deuts**c**hland" },
  },
  {
    label: "bolds multiple missing chars in a sentence",
    input: "ich kome aus deutshland",
    correct: "Ich komme aus Deutschland",
    expected: { correctedMarkdown: "**I**ch ko**m**me aus **D**euts**c**hland" },
  },
  {
    label: "bolds wrong character (substitution)",
    input: "hallo",
    correct: "hello",
    expected: { correctedMarkdown: "h**e**llo" },
  },
  {
    label: "handles extra character in input gracefully",
    input: "helllo",
    correct: "hello",
    expected: { correctedMarkdown: "hello" },
  },
  {
    label: "bolds missing character at start",
    input: "eutschland",
    correct: "Deutschland",
    expected: { correctedMarkdown: "**D**eutschland" },
  },
  {
    label: "preserves ß in output and bolds it when wrong",
    input: "strase",
    correct: "Straße",
    expected: { correctedMarkdown: "**S**tra**ß**e" },
  },
  {
    label: "bolds missing chars at end",
    input: "I am go",
    correct: "I am good",
    expected: { correctedMarkdown: "I am go**od**" },
  },
  {
    label: "bolds swapped/wrong region",
    input: "teh",
    correct: "the",
    expected: { correctedMarkdown: "t**he**" },
  },
  {
    label: "Shows correct answer with missing space",
    input: "ichlerne",
    correct: "ich lerne",
    expected: { isCorrect: true, similarity: 1, correctedMarkdown: "ich lerne" },
  },
  // --- New: curly apostrophe markdown ---
  {
    label: "no diff when curly apostrophe matches straight",
    input: "don\u2019t",
    correct: "don't",
    expected: { correctedMarkdown: "don't" },
  },
];

// ---------------------------------------------------------------------------
// checkBestMatch cases
// ---------------------------------------------------------------------------

const bestMatchCases: BestMatchTestCase[] = [
  {
    label: "returns exact match when available",
    input: "street",
    correctAnswers: ["Straße", "Street", "Road"],
    expected: { isCorrect: true, similarity: 1, correctedMarkdown: "Street" },
  },
  {
    label: "returns best match from multiple options (ß/ss)",
    input: "strasse",
    correctAnswers: ["Straße", "Street", "Road"],
    expected: { isCorrect: true, similarity: 1 },
  },
  {
    label: "picks closest answer when none is exact",
    input: "stret",
    correctAnswers: ["Straße", "Street", "Road"],
    expected: { correctedMarkdown: "**S**tr**e**et", similarityGt: 0.7 },
  },
  {
    label: "works with acceptAlso pattern (full form)",
    input: "i am tired",
    correctAnswers: ["I am tired", "I'm tired"],
    expected: { isCorrect: true },
  },
  {
    label: "works with acceptAlso pattern (contraction)",
    input: "i'm tired",
    correctAnswers: ["I am tired", "I'm tired"],
    expected: { isCorrect: true },
  },
  {
    label: "throws on empty answers array",
    input: "hello",
    correctAnswers: [],
    expected: {}, // special case: tested separately for throw
  },
];

// ---------------------------------------------------------------------------
// Test runner
// ---------------------------------------------------------------------------

describe("checkSimilarity", () => {
  describe("normalization", () => {
    for (const c of normalizationCases) {
      test(c.label, () => {
        const result = checkSimilarity(c.input, c.correct, c.options);
        assertCase(c, result);
      });
    }
  });

  describe("threshold", () => {
    for (const c of thresholdCases) {
      test(c.label, () => {
        const result = checkSimilarity(c.input, c.correct, c.options);
        assertCase(c, result);
      });
    }
  });

  describe("similarity score", () => {
    for (const c of similarityCases) {
      test(c.label, () => {
        const result = checkSimilarity(c.input, c.correct, c.options);
        assertCase(c, result);
      });
    }
  });

  describe("correctedMarkdown", () => {
    for (const c of markdownCases) {
      test(c.label, () => {
        const result = checkSimilarity(c.input, c.correct, c.options);
        assertCase(c, result);
      });
    }
  });
});

describe("checkBestMatch", () => {
  for (const c of bestMatchCases) {
    if (c.correctAnswers.length === 0) {
      test(c.label, () => {
        expect(() => checkBestMatch(c.input, c.correctAnswers, c.options)).toThrow(
          "checkBestMatch requires at least one correct answer",
        );
      });
    } else {
      test(c.label, () => {
        const result = checkBestMatch(c.input, c.correctAnswers, c.options);
        // Reuse assertCase with a synthetic SimilarityTestCase
        assertCase(
          { ...c, correct: c.correctAnswers.join(" | ") },
          result,
        );
      });
    }
  }
});
