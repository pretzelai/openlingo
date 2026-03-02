# Plan: Improve Similarity Function & Test Suite

## Research Findings

### Current Architecture
- **`lib/similarity.ts`** (239 lines) — exports `checkSimilarity` and `checkBestMatch`
- **`lib/similarity.test.ts`** (190 lines) — 33 tests using `bun:test`
- Consumers: `components/exercises/translation.tsx` (uses `checkBestMatch`), `components/exercises/fill-in-the-blank.tsx` (uses `checkSimilarity`)
- All 33 existing tests pass

### Bugs Found

#### BUG 1 (HIGH) — `correctAnswer` is never trimmed
`userInput` is trimmed (line 180) but `correctAnswer` is not. If the correct answer has leading/trailing whitespace (common in DB data, markdown parsing artifacts), it causes false negatives.

```
checkSimilarity("hello", " hello ") → isCorrect: false, similarity: 0.714
```
**Fix:** Also trim `correctAnswer`.

#### BUG 2 (HIGH) — Surrogate pairs are split, corrupting emoji/supplementary Unicode
The `for (let i = 0; i < s.length; i++)` loop in `normalizeWithMapping` indexes by UTF-16 code units. Emoji like `🎉` (U+1F389) are 2 code units; `s[i]` gives a lone surrogate.

**Fix:** Use `Array.from(s)` or `for...of` to iterate by code point. This is a defensive fix — emoji input is unlikely in language exercises but the function should not produce corrupt output.

#### BUG 3 (MEDIUM) — Curly apostrophe `'` (U+2019) not normalized to straight `'` (U+0027)
Phone keyboards frequently produce curly/smart quotes. The function treats them as different characters.

```
checkSimilarity("don\u2019t", "don't") → similarity: 0.8, apostrophe bolded as wrong
```
**Fix:** Normalize `'` (U+2019) and `'` (U+2018) to `'` (U+0027) during normalization.

#### BUG 4 (MEDIUM) — `checkBestMatch` crashes on empty array
`best!` non-null assertion on line 238 is a lie when `correctAnswers` is empty. Callers crash.

**Fix:** Return a sensible zero-similarity result, or throw an explicit error.

#### BUG 5 (LOW) — `similarity: 0` with `isCorrect: true` is contradictory
Single-character comparisons like `checkSimilarity("a", "b")` produce `isCorrect: true` (distance 1 <= threshold 1) but `similarity: 0`.

**Fix:** For very short strings (length ≤ 2), automatically lower the effective threshold so that 100% of the string being wrong doesn't pass. Specifically: `effectiveThreshold = Math.min(threshold, Math.floor(maxLen / 2))` — so a 1-char string requires exact match, a 2-char string allows 1 typo, etc.

#### BUG 6 (LOW) — Tab/newline not normalized to space
`\t` and `\n` in input are not converted to spaces.

```
checkSimilarity("ich\tlerne", "ich lerne") → similarity: 0.889
```
**Fix:** Replace `\s+` with a single space in normalization (after trim).

#### BUG 7 (LOW) — Punctuation-only strings all match each other
Strings like `"..."` and `"!!!"` both normalize to `""`, yielding `similarity: 1`. This is an edge case unlikely in practice but worth handling.

**Fix:** After normalization, if both strings are empty but the originals differ, return `similarity: 1` (we consider punctuation-only inputs as correct since the function's purpose is language answer checking where punctuation is irrelevant). This is actually acceptable behavior — no fix needed, just document it.

### Design Decisions

1. **Trim `correctAnswer`** — Safe change. Both consumers already pass non-whitespace-padded strings, but this makes the function robust.
2. **Curly apostrophe normalization** — Also normalize common smart-quote variants (`"` `"` → `"`).
3. **Effective threshold scaling** — Prevents nonsensical results on very short strings without changing behavior on normal-length answers.
4. **Empty array guard** — Throw an error rather than returning a fake result, since callers always expect a valid result.
5. **Tab/whitespace normalization** — Collapse all whitespace (`\s+`) to single space during normalization.
6. **Surrogate-safe iteration** — Use `for...of` loop or spread to iterate by code point.
7. **Punctuation-only edge case** — Leave as-is (acceptable behavior for a language exercise checker).

### Test Suite Redesign

The user wants:
1. **Table-driven tests** — A flat array of `{ input, correctAnswer, expected }` objects that are easy to edit
2. **Clear failure messages** — When a test case fails, the error message must show the input, expected output, actual output, and which field was wrong — so an AI can read the failure and improve the function

We'll use `test.each`-style patterns with `bun:test`. Bun supports `describe` + `test` but not `test.each` natively, so we'll loop over the array with descriptive labels.

Structure:
```ts
interface SimilarityTestCase {
  label: string;
  input: string;
  correct: string;
  options?: SimilarityOptions;
  expected: {
    isCorrect: boolean;
    similarity?: number;          // exact match
    similarityGt?: number;        // greater than
    similarityLt?: number;        // less than
    correctedMarkdown?: string;   // exact match
  };
}

const cases: SimilarityTestCase[] = [ ... ];

for (const c of cases) {
  test(c.label, () => {
    const result = checkSimilarity(c.input, c.correct, c.options);
    // Custom assertions with detailed messages
  });
}
```

Failure message format:
```
Case: "ignores case"
  Input:    "i am tired"
  Correct:  "I am tired"
  Expected: isCorrect=true, similarity=1
  Actual:   isCorrect=false, similarity=0.8
  Field:    isCorrect — expected true but got false
```

## Implementation Todo

1. Fix `similarity.ts` — trim correctAnswer
2. Fix `similarity.ts` — normalize curly apostrophes/quotes to straight
3. Fix `similarity.ts` — collapse whitespace (`\s+` → single space) in normalization
4. Fix `similarity.ts` — use code-point-safe iteration in `normalizeWithMapping`
5. Fix `similarity.ts` — scale effective threshold for very short strings
6. Fix `similarity.ts` — guard `checkBestMatch` against empty array
7. Rewrite `similarity.test.ts` — table-driven format with test case arrays
8. Add test cases for all new fixes (trimming, apostrophes, whitespace, short strings, empty array)
9. Ensure all existing test scenarios are preserved in the new format
10. Run tests to verify everything passes
