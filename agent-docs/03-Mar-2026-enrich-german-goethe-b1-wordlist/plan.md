# Plan: Enrich `words/german.json` with Goethe B1 markers

## What I researched

- `words/enrich_german_certificate.ts` currently exists but is empty.
- `words/german.json` is a large JSON array of objects with at least:
  - `word` (string)
  - `cefr_level` (string)
  - optional linguistic fields (`gender`, `pos`, etc.)
- `words/goethe-zertifikat-b1-wortliste.csv` is not a simple one-line-per-row CSV:
  - it contains quoted fields with embedded commas
  - it contains quoted fields with embedded newlines (multi-line examples)
  - first line appears to be a metadata/title line, not lexical data

## Functional requirements to satisfy

1. Parse Goethe B1 CSV safely with quoted fields and multiline values.
2. For each lexical entry, use the first CSV column as source text.
3. Clean first-column text:
  - if it starts with `der` , `die` , or `das` , extract that as noun gender and remove the prefix from the word stem
  - then keep only substring before the first comma
  - trim whitespace
4. Match cleaned word against `german.json` entries by `.word`.
5. If matched:
  - verify `cefr_level === "B1"`
  - if true, set `goethe_wordlist: true` on that entry
6. If not matched, log error.
7. If matched but CEFR is not `B1`, log error.
8. Write errors to `logs.txt`, one per line, exactly:
  - `{word}, {line in csv}: {error}`

## Design decisions

- Use a robust CSV parser strategy that handles multiline quoted records correctly.
  - Preferred: parser implementation in the script (state-machine style), so no dependency changes are needed.
- Build an index map from `german.json` (`word -> entry index`) for O(1) lookup per CSV row.
- Track source CSV line number for each parsed row so logging can include the requested `{line in csv}`.
- Preserve existing `german.json` fields and formatting semantics (rewrite file as valid JSON with pretty-printing).
- Treat `goethe_wordlist` as optional; only add it to matched B1 entries from the Goethe list.
- Keep noun gender extraction in parsing flow for correctness and future extensibility; matching will use the cleaned noun stem as requested.

## Edge cases to handle explicitly

- Header/metadata line at top of CSV should be skipped if it is not a lexical entry.
- Empty first-column values after cleaning should be skipped (or logged as malformed, depending on final implementation detail).
- Duplicate Goethe entries for the same cleaned word should not cause duplicated writes; use a set or idempotent assignment.
- If multiple `german.json` entries share the same `.word`, decide deterministic behavior (e.g., mark all or first). Recommended: mark all exact matches and validate CEFR on each.
- Unicode should remain intact (`ö`, `ü`, `ß`, etc.); avoid lossy normalization unless needed for exact-match failures.

## Implementation steps (todo)

- Implement `words/enrich_german_certificate.ts`:
  - read CSV and JSON files
  - parse CSV with multiline-quote-safe logic and row line numbers
  - clean first-column word text (article stripping + pre-comma extraction)
  - look up matches in `german.json` by `.word`
  - set `goethe_wordlist: true` for matched B1 entries
  - collect errors for not-found and CEFR mismatch cases
  - write updated `words/german.json`
  - write `words/logs.txt` with requested line format
- Run the script with Bun and validate outputs.
- Quick sanity checks:
  - logs are generated and formatted correctly
  - at least sample matched B1 entries got `goethe_wordlist: true`
  - no TypeScript/runtime errors

