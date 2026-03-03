# Plan: Add "Goethe B1 Wordlist" bulk-add button in `/words`

## What I researched

### Current `/words` data flow

- `app/(main)/words/page.tsx` loads words with `loadLanguageRaw(language)` from `lib/words.ts`.
- `lib/words.ts` reads from the `dictionary_word` table (not directly from `words/german.json`).
- `app/(main)/words/word-explorer.tsx` receives `words` and currently supports:
  - per-word add/remove via `addWordToSrs` / `removeWordFromSrs`
  - per-CEFR bulk add via `bulkAddWordsToSrs`
- SRS writes are already deduplicated via `onConflictDoNothing()` in `lib/actions/srs.ts`.

### Why this matters for `goethe_b1_wordlist`

- Even though `words/german.json` now has `goethe_b1_wordlist`, the `/words` UI can only use fields exposed through:
  1. DB schema (`lib/db/schema.ts`)
  2. seed import (`lib/db/seed-words.ts`)
  3. runtime mapping (`lib/words.ts`)
  4. UI `Word` type (`app/(main)/words/word-explorer.tsx`)
- Today, none of those DB-backed layers include `goethe_b1_wordlist`.

### Existing schema/seed baseline

- `dictionary_word` currently stores `useful_for_flashcard`, but no Goethe flag.
- `seed-words.ts` parses JSON and inserts known fields, but ignores `goethe_b1_wordlist`.
- Existing Drizzle migrations are in `drizzle/0000...0003` with `drizzle/meta/_journal.json` and snapshots.

## Implementation design

### 1) Persist Goethe flag in dictionary data

- Add nullable/optional boolean column to `dictionary_word`:
  - TypeScript schema: `goetheB1Wordlist: boolean("goethe_b1_wordlist")`
  - SQL migration: `ALTER TABLE "dictionary_word" ADD COLUMN "goethe_b1_wordlist" boolean;`
- Add the field to seed ingestion:
  - extend `RawWord` with `goethe_b1_wordlist?: boolean`
  - map to insert row with `goetheB1Wordlist: w.goethe_b1_wordlist ?? null`

Reasoning:
- UI feature depends on this flag being queryable with the rest of dictionary metadata.
- Nullable keeps compatibility with non-German languages and older datasets.

### 2) Expose Goethe flag to `/words` page data

- Extend `WordEntry` in `lib/words.ts` with `goethe_b1_wordlist?: boolean`.
- Map DB row -> `WordEntry` in `rowToWordEntry`:
  - `goethe_b1_wordlist: row.goetheB1Wordlist ?? undefined`
- Extend `Word` interface in `word-explorer.tsx` accordingly.

### 3) Add bulk button behavior in `AllWordsTab`

- Compute Goethe candidates:
  - `goetheWords = words.filter(w => w.goethe_b1_wordlist === true)`
- Exclude already-added cards:
  - `newGoetheWords = goetheWords.filter(w => !srsSet.has(w.word.toLowerCase()))`
- Add a new handler:
  - call `bulkAddWordsToSrs(newGoetheWords.map(...), language)`
  - `router.refresh()` after completion
- Add button UI (in same action area as existing bulk button):
  - label exactly: `Add Goethe B1 Wordlist ({word_count} words)`
  - where `word_count = newGoetheWords.length` (remaining words that will actually be added)
  - disable while pending
  - hide button when `word_count === 0` (or optionally show a completion message)

Reasoning:
- Using remaining count avoids promising inserts that will no-op due to conflicts.
- Reusing existing server action avoids new endpoints and keeps behavior consistent.

### 4) Keep interaction safe and predictable

- Use current `isPending` transition guard to prevent duplicate submissions.
- Keep existing CEFR-level bulk add unchanged.
- No destructive migration/data rewrite; additive-only change.

## Edge cases to handle

- Non-German languages: flag usually absent, button should not appear (count 0).
- Existing user already has some/all Goethe words:
  - count reflects only new words left to add.
- Duplicate dictionary words with case differences:
  - SRS normalization and `srsSet` lowercase matching already handle this.
- Large Goethe set:
  - existing `bulkAddWordsToSrs` batching (500 rows) is sufficient.

## Validation plan (after implementation)

- Type-check/lint edited files with `bun` tooling (`bun run lint` or focused checks).
- Manual verification in `/words`:
  - button appears when Goethe words exist
  - label count matches remaining addable words
  - clicking adds words and decreases/removes button count after refresh
  - no regression to level bulk add and single-word add/remove

## Todo list (implementation order)

1. Add `goethe_b1_wordlist` column in `lib/db/schema.ts`.
2. Add new Drizzle migration SQL and update migration metadata files.
3. Update `lib/db/seed-words.ts` to import `goethe_b1_wordlist`.
4. Update `lib/words.ts` `WordEntry` + row mapping.
5. Update `app/(main)/words/word-explorer.tsx` types and add Goethe bulk logic/button.
6. Run lint/type checks with bun.
7. Verify `/words` UX manually and confirm expected behavior.
