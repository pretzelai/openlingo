/**
 * String similarity checking with normalization and character-level diff.
 *
 * Normalization: lowercases, strips diacritics (ä→a, é→e, ñ→n, …),
 * strips punctuation (.,;:!?¿¡), and treats ß as "ss" — so "Straße" ≈ "strasse".
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

function normalizeWithMapping(s: string): NormalizedMapping {
  const origIndices: number[] = [];
  let normalized = "";

  for (let i = 0; i < s.length; i++) {
    if (s[i] === "ß") {
      normalized += "ss";
      origIndices.push(i, i);
    } else {
      const base = s[i]
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[.,;:!?¿¡]/g, "");
      for (let k = 0; k < base.length; k++) {
        normalized += base[k];
        origIndices.push(i);
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

  const userTrimmed = userInput.trim();
  const userMapping = normalizeWithMapping(userTrimmed);
  const correctMapping = normalizeWithMapping(correctAnswer);

  if (userMapping.normalized === correctMapping.normalized) {
    return { isCorrect: true, similarity: 1, correctedMarkdown: correctAnswer };
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
        if (userTrimmed[userOrigIdx] !== correctAnswer[correctOrigIdx]) {
          boldIndices.add(correctOrigIdx);
        }
      }
    }
  }

  return {
    isCorrect: distance <= threshold,
    similarity,
    correctedMarkdown: buildMarkdown(correctAnswer, boldIndices),
  };
}

/** Compare user input against multiple accepted answers; return the best match. */
export function checkBestMatch(
  userInput: string,
  correctAnswers: string[],
  options: SimilarityOptions = {},
): SimilarityResult {
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
