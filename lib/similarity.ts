/**
 * String similarity checking with normalization and character-level diff.
 *
 * Normalization: lowercases, strips diacritics (ä→a, é→e, ñ→n, …),
 * strips punctuation (.,;:!?¿¡), normalizes curly quotes/apostrophes,
 * collapses whitespace, and treats ß as "ss" — so "Straße" ≈ "strasse".
 *
 * The correctedMarkdown bolds every character in the correct answer
 * that the user got wrong or missed.
 */

export interface SimilarityResult {
  isCorrect: boolean;
  similarity: number;
  /** Correct answer with wrong/missing chars wrapped in **bold** */
  correctedMarkdown: string;
}

export interface SimilarityOptions {
  /** Max Levenshtein distance (post-normalization) to still count as correct. Default: 1 */
  threshold?: number;
}

// ---------------------------------------------------------------------------
// Normalization
// ---------------------------------------------------------------------------

interface NormalizedMapping {
  normalized: string;
  /** For each normalized char, the index in the original string it came from */
  origIndices: number[];
}

/**
 * Pre-normalize: curly quotes → straight, collapse whitespace → single space, trim.
 * Returns the cleaned string so downstream normalization can work on it.
 */
function preNormalize(s: string): string {
  return s
    .replace(/[\u2018\u2019\u2032]/g, "'") // curly single quotes → straight
    .replace(/[\u201C\u201D\u2033]/g, '"') // curly double quotes → straight
    .replace(/\s+/g, " ") // collapse all whitespace (tabs, newlines, multi-space) → single space
    .trim();
}

function normalizeWithMapping(s: string): NormalizedMapping {
  const origIndices: number[] = [];
  let normalized = "";

  // Use Array.from to iterate by code point (surrogate-safe)
  const codePoints = Array.from(s);
  let charIdx = 0; // index in the original string (by code unit)

  for (const char of codePoints) {
    const origIdx = charIdx;
    charIdx += char.length; // surrogate pairs have length 2

    if (char === "ß") {
      normalized += "ss";
      origIndices.push(origIdx, origIdx);
    } else {
      const base = char
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[.,;:!?¿¡]/g, "");
      for (let k = 0; k < base.length; k++) {
        normalized += base[k];
        origIndices.push(origIdx);
      }
    }
  }

  return { normalized, origIndices };
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/ß/g, "ss")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[.,;:!?¿¡]/g, "");
}

// ---------------------------------------------------------------------------
// Levenshtein with backtrace
// ---------------------------------------------------------------------------

interface LevenshteinResult {
  distance: number;
  /** One entry per character in `correct` */
  ops: ("match" | "bold")[];
  /** For each op, the corresponding index in `user` (null for insertions) */
  userIndices: (number | null)[];
}

function levenshteinOps(
  user: string,
  correct: string,
): LevenshteinResult {
  const m = user.length;
  const n = correct.length;

  const dp: number[][] = Array.from({ length: m + 1 }, () =>
    Array(n + 1).fill(0),
  );

  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (user[i - 1] === correct[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1];
      } else {
        dp[i][j] =
          1 +
          Math.min(
            dp[i - 1][j], // delete (extra char in user input)
            dp[i][j - 1], // insert (user missed a char from correct)
            dp[i - 1][j - 1], // substitute
          );
      }
    }
  }

  // Backtrace — one entry per character in `correct`
  const ops: ("match" | "bold")[] = [];
  const userIndices: (number | null)[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && user[i - 1] === correct[j - 1]) {
      ops.unshift("match");
      userIndices.unshift(i - 1);
      i--;
      j--;
    } else if (
      i > 0 &&
      j > 0 &&
      dp[i][j] === dp[i - 1][j - 1] + 1
    ) {
      // substitution
      ops.unshift("bold");
      userIndices.unshift(i - 1);
      i--;
      j--;
    } else if (j > 0 && dp[i][j] === dp[i][j - 1] + 1) {
      // insertion — char in correct is missing from user
      ops.unshift("bold");
      userIndices.unshift(null);
      j--;
    } else {
      // deletion — extra char in user, skip
      i--;
    }
  }

  // -----------------------------------------------------------------------
  // Post-process: improve bold contiguity.
  //
  // The backward backtrace greedily matches from the right, which can split
  // bold regions when duplicate characters exist. For example, "go" → "good"
  // produces [match g, bold o, match o, bold d] — bolding is non-contiguous.
  //
  // If we find a (bold-insertion, match) pair on the same character where
  // shifting the match left would merge into a contiguous bold run, swap them.
  // -----------------------------------------------------------------------
  for (let k = 0; k < ops.length - 1; k++) {
    if (
      ops[k] === "bold" &&
      userIndices[k] === null && // insertion (not substitution)
      ops[k + 1] === "match" &&
      correct[k] === correct[k + 1] // same char in correct
    ) {
      // Check if swapping creates or extends a contiguous bold region:
      // there must be a bold at k+2 (or k+1 is the last position).
      const hasBoldAfter = k + 2 < ops.length && ops[k + 2] === "bold";
      const isAtEnd = k + 2 >= ops.length;
      if (hasBoldAfter || isAtEnd) {
        // Swap: move the match earlier, push the bold later
        ops[k] = "match";
        ops[k + 1] = "bold";
        userIndices[k] = userIndices[k + 1];
        userIndices[k + 1] = null;
      }
    }
  }

  return { distance: dp[m][n], ops, userIndices };
}

// ---------------------------------------------------------------------------
// Markdown builder
// ---------------------------------------------------------------------------

function buildMarkdown(original: string, boldIndices: Set<number>): string {
  let result = "";
  let inBold = false;

  for (let i = 0; i < original.length; i++) {
    const shouldBold = boldIndices.has(i);
    if (shouldBold && !inBold) {
      result += "**";
      inBold = true;
    } else if (!shouldBold && inBold) {
      result += "**";
      inBold = false;
    }
    result += original[i];
  }
  if (inBold) result += "**";

  return result;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Compare a single user input against one correct answer. */
export function checkSimilarity(
  userInput: string,
  correctAnswer: string,
  options: SimilarityOptions = {},
): SimilarityResult {
  const { threshold = 1 } = options;

  const userTrimmed = preNormalize(userInput);
  const correctTrimmed = preNormalize(correctAnswer);

  const userMapping = normalizeWithMapping(userTrimmed);
  const correctMapping = normalizeWithMapping(correctTrimmed);

  // For equality check, also strip spaces so "ichlerne" ≈ "ich lerne"
  const userSpaceless = userMapping.normalized.replace(/ /g, "");
  const correctSpaceless = correctMapping.normalized.replace(/ /g, "");

  if (userSpaceless === correctSpaceless) {
    return { isCorrect: true, similarity: 1, correctedMarkdown: correctTrimmed };
  }

  const { distance, ops, userIndices } = levenshteinOps(
    userMapping.normalized,
    correctMapping.normalized,
  );
  const maxLen = Math.max(
    userMapping.normalized.length,
    correctMapping.normalized.length,
  );
  const similarity = maxLen === 0 ? 1 : 1 - distance / maxLen;

  // Scale threshold for very short strings to avoid contradictory results
  // (e.g. "a" vs "b" should not be isCorrect with similarity 0)
  const effectiveThreshold = Math.min(threshold, Math.floor(maxLen / 2));

  const boldIndices = new Set<number>();
  for (let k = 0; k < ops.length; k++) {
    const correctOrigIdx = correctMapping.origIndices[k];
    if (ops[k] === "bold") {
      boldIndices.add(correctOrigIdx);
    } else {
      // "match" in normalized form — also check if originals differ (case, diacritics)
      const uNormIdx = userIndices[k];
      if (uNormIdx !== null) {
        const userOrigIdx = userMapping.origIndices[uNormIdx];
        if (userTrimmed[userOrigIdx] !== correctTrimmed[correctOrigIdx]) {
          boldIndices.add(correctOrigIdx);
        }
      }
    }
  }

  return {
    isCorrect: distance <= effectiveThreshold,
    similarity,
    correctedMarkdown: buildMarkdown(correctTrimmed, boldIndices),
  };
}

/** Compare user input against multiple accepted answers; return the best match. */
export function checkBestMatch(
  userInput: string,
  correctAnswers: string[],
  options: SimilarityOptions = {},
): SimilarityResult {
  if (correctAnswers.length === 0) {
    throw new Error("checkBestMatch requires at least one correct answer");
  }

  let best: SimilarityResult | null = null;

  for (const answer of correctAnswers) {
    const result = checkSimilarity(userInput, answer, options);
    if (result.isCorrect && result.similarity === 1) return result;
    if (!best || result.similarity > best.similarity) {
      best = result;
    }
  }

  return best!;
}
