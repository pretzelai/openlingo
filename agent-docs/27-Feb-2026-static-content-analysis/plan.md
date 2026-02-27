# Static Content & Assets Analysis for Frontend-Only Vite Rewrite

## Executive Summary

The codebase is a Next.js language-learning app ("OpenLingo") with content authored as markdown, dictionaries as JSON, and user data in PostgreSQL. This analysis determines what can be bundled into a pure frontend Vite app vs. what must remain behind an API.

**Key finding:** The content parsing pipeline (`lib/content/`) and the SRS algorithm (`lib/srs.ts`, `lib/srs-words.ts`) are **pure functions with zero server dependencies** and can be directly imported into a Vite frontend. The dictionary data (94 MB total) is too large to bundle but can be lazy-loaded per-language. The markdown content files (18 KB total) are trivially bundleable.

---

## 1. `/repo/content/` -- Markdown Content Files

### Structure

| File | Size | Type | Description |
|------|------|------|-------------|
| `testing-course.md` | 190 B | Course definition | YAML frontmatter only: id, courseTitle, description, sourceLanguage, targetLanguage, level |
| `testing-unit-0.md` | 506 B | Unit (multiple-choice) | Part of testing course (courseId references the course) |
| `testing-unit-1.md` | 578 B | Unit (translation) | Part of testing course |
| `testing-unit-2.md` | 461 B | Unit (fill-in-the-blank) | Part of testing course |
| `testing-unit-3.md` | 509 B | Unit (matching-pairs) | Part of testing course |
| `testing-unit-4.md` | 432 B | Unit (listening) | Part of testing course |
| `testing-unit-5.md` | 519 B | Unit (word-bank) | Part of testing course |
| `testing-unit-6.md` | 396 B | Unit (speaking) | Part of testing course |
| `testing-unit-7.md` | 881 B | Unit (free-text) | Part of testing course |
| `steve-jobs-a1-german.md` | 3.6 KB | Standalone unit | 5 lessons, multi-exercise, German A1 |
| `steve-jobs-a1-spanish.md` | 3.9 KB | Standalone unit | 5 lessons, multi-exercise, Spanish A1 |

**Total size: ~18 KB** (11 files)

### File Format

**Course files** (`*-course.md`): YAML frontmatter only with fields: `id`, `courseTitle`, `description`, `sourceLanguage`, `targetLanguage`, `level`. The course ID is either from the `id` field or derived from filename (`testing-course.md` -> `testing`).

**Unit files**: Two-layer structure:
1. **Unit frontmatter** (YAML `---` delimited): `unitTitle`, `description`, `icon`, `color`, `targetLanguage`, `sourceLanguage`, `level`, optional `courseId`
2. **Lesson blocks**: Each `---` delimited YAML sub-block defines a lesson (`lessonTitle`, `description`, `icon`, `color`), followed by exercise blocks
3. **Exercise blocks**: Custom DSL starting with `[type-tag]` followed by `key: value` fields. Types: `multiple-choice`, `translation`, `fill-in-the-blank`, `matching-pairs`, `listening`, `word-bank`, `speaking`, `free-text`, `flashcard-review`

### How They're Loaded

1. `loader.ts` uses Node.js `fs` to scan the `content/` directory at startup
2. Courses and units are parsed from raw markdown
3. `registry.ts` caches the parsed results in memory (singleton pattern)
4. `seed-content.ts` uses the registry to seed parsed content into the PostgreSQL database (`course` and `unit` tables)
5. **After seeding, the filesystem files are NOT used at runtime** -- all content is served from the DB `unit.markdown` column

### Bundling Verdict

| Aspect | Verdict |
|--------|---------|
| **Can bundle with frontend?** | YES -- trivially. 18 KB total. Could import as raw strings via Vite's `?raw` import |
| **Needs API?** | NO for static seed content. However, user-created content lives only in DB |
| **Server-side processing?** | Only for the initial DB seed. The parsing itself is pure TypeScript |
| **Key consideration** | Users can create their own units in the DB via the AI chat. A frontend-only app would only have the 11 seed files unless it fetches user content from an API |

---

## 2. `/repo/words/` -- Dictionary JSON Files

### Structure & Sizes

| File | Size | Entries | Language |
|------|------|---------|----------|
| `arabic.json` | 6.1 MB | 13,143 | ar |
| `english.json` | 5.9 MB | 20,708 | en |
| `french.json` | 6.3 MB | 17,580 | fr |
| `german.json` | 9.9 MB | 20,280 | de |
| `hindi.json` | 5.5 MB | 13,983 | hi |
| `italian.json` | 6.0 MB | 16,887 | it |
| `japanese-hiragana.json` | 1.4 MB | 3,880 | ja (hiragana) |
| `japanese-kanji.json` | 8.6 MB | 24,158 | ja (kanji) |
| `japanese-katakana.json` | 3.3 MB | 9,164 | ja (katakana) |
| `korean.json` | 12 MB | 24,041 | ko |
| `mandarin.json` | 15 MB | 39,605 | zh |
| `portuguese.json` | 5.9 MB | 15,250 | pt |
| `russian.json` | 4.3 MB | 11,345 | ru |
| `spanish.json` | 5.3 MB | 16,392 | es |
| `b1_german_nouns.csv` | 241 KB | N/A | Supplementary CSV |

**Total: ~94 MB** (14 JSON files + 1 CSV)

### Entry Format (per word)

```json
{
  "word": "sein",
  "useful_for_flashcard": true,
  "cefr_level": "A1",
  "english_translation": "to be",
  "romanization": "sein",
  "example_sentence_native": "Er will Arzt sein.",
  "example_sentence_english": "He wants to be a doctor.",
  "gender": "",
  "is_separable_verb": false,
  "separable_prefix": "",
  "base_verb": "",
  "capitalization_sensitive": false,
  "pos": "verb",
  "word_frequency": 6
}
```

Some language-specific fields vary (e.g., German has `is_separable_verb`, `separable_prefix`; Japanese has `romanization`). Core fields are consistent: `word`, `cefr_level`, `english_translation`, `pos`, `example_sentence_native`, `example_sentence_english`, `useful_for_flashcard`, `word_frequency`.

### How They're Used

1. `seed-words.ts` reads JSON files from disk and bulk-inserts into the `dictionary_word` PostgreSQL table at setup
2. At runtime, `lib/words.ts` queries the DB (NOT the JSON files) via Drizzle ORM
3. `lookupWord()` first tries the `dictionary_word` table, then falls back to AI lookup (via `generateObject()`)
4. Dictionary data is consumed by: word lookup tooltips, SRS deck population, the AI chat tool `bulk-add-words`

### Bundling Verdict

| Aspect | Verdict |
|--------|---------|
| **Can bundle with frontend?** | NOT ALL AT ONCE -- 94 MB is too large for a bundle. Individual files (1.4-15 MB) could be lazy-loaded per language |
| **Needs API?** | For full dictionary lookup with AI fallback, YES (AI needs server keys). For basic offline dictionary, NO -- lazy-load JSON per language |
| **Server-side processing?** | The seed process is server-only. The AI word lookup (`generateObject()`) requires server-side AI API keys |
| **Recommended approach** | Lazy-load individual language JSONs on demand. Place in `/public/words/` or a CDN. Load into IndexedDB for offline use. Average per-language is ~6.7 MB which is manageable as a one-time download per language |

---

## 3. `/repo/public/` -- Static Assets

### Files & Sizes

| File | Size | Purpose |
|------|------|---------|
| `manifest.json` | 501 B | PWA manifest (name: "OpenLingo", standalone display) |
| `icon-192.png` | 7.4 KB | PWA icon 192x192 |
| `icon-512.png` | 26 KB | PWA icon 512x512 |
| `apple-touch-icon.png` | 7.1 KB | iOS home screen icon |
| `icon.svg` | 1.1 KB | SVG icon |
| `google.svg` | 1.2 KB | Google OAuth button icon |
| `globe.svg` | 1.1 KB | Globe icon |
| `file.svg` | 391 B | File icon |
| `window.svg` | 385 B | Window icon |
| `next.svg` | 1.4 KB | Next.js logo (can remove) |
| `vercel.svg` | 128 B | Vercel logo (can remove) |

**Total: ~46 KB**

### Manifest Details

```json
{
  "name": "OpenLingo",
  "short_name": "OpenLingo",
  "description": "OpenSource AI connected to language learning",
  "start_url": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#58CC02"
}
```

### Bundling Verdict

| Aspect | Verdict |
|--------|---------|
| **Can bundle with frontend?** | YES -- all of it. Direct copy to Vite's `public/` folder |
| **Needs API?** | NO |
| **Server-side processing?** | NONE |
| **Notes** | Remove `next.svg` and `vercel.svg` (Next.js branding). Keep PWA manifest and icons. `google.svg` needed for OAuth UI |

---

## 4. `/repo/lib/content/` -- Content Parsing Pipeline

### File-by-File Analysis

#### `types.ts` (233 lines)
Pure TypeScript interfaces and types. No imports from server modules. Defines:
- `Exercise` (discriminated union of 9 exercise types)
- `ParsedUnit`, `ParsedUnitMeta`, `UnitLesson`, `ParsedCourse`
- `Course`, `Unit`, `CourseListItem`, `StandaloneUnitInfo`, `UnitWithContent`, etc.
- **100% frontend-compatible**

#### `exercise-schema.ts` (138 lines)
Zod schemas for all 9 exercise types. Only imports from `zod`. Defines validation schemas that mirror the TypeScript types. Used by the parser to validate parsed exercises.
- **100% frontend-compatible** (Zod runs in any JS environment)

#### `parser.ts` (330 lines)
The core exercise parser. Pure functions, no `fs`, no `path`, no server imports. Functions:
- `parseExercisesFromMarkdown(content: string): Exercise[]` -- splits markdown on `[type-tag]` boundaries, parses each block
- `parseExercise(block: string): Exercise` -- dispatches to type-specific parsers
- Individual parsers for each exercise type (`parseMultipleChoice`, `parseTranslation`, etc.)
- Utility functions: `stripNoAudio()`, `getField()`, `hasFlag()`, `getOptionalField()`, `parseSrsWords()`
- **100% frontend-compatible**

#### `course-parser.ts` (36 lines)
Parses course markdown frontmatter using `gray-matter`. Pure function.
- `parseCourseMarkdown(raw: string): ParsedCourse`
- Imports only `gray-matter` and local types
- **100% frontend-compatible** (`gray-matter` works in browser)

#### `unit-parser.ts` (81 lines)
Parses unit markdown files (frontmatter + lesson blocks + exercises). Uses `gray-matter` and `parser.ts`.
- `parseUnitMarkdown(raw: string): ParsedUnit`
- Regex-based lesson block splitting, then delegates exercises to `parseExercisesFromMarkdown()`
- **100% frontend-compatible**

#### `loader.ts` (96 lines)
**THE ONLY SERVER-DEPENDENT FILE.** Uses Node.js `fs` and `path` to scan the content directory.
- `loadContentDir()` -- reads all `.md` files from the `content/` directory on disk
- `getUnitLessons(markdown: string): UnitLesson[]` -- pure wrapper around `parseUnitMarkdown()` (no fs)
- `getUnitLessonsSafe()` -- safe version with error handling (no fs)
- **`loadContentDir()` is server-only; `getUnitLessons()` and `getUnitLessonsSafe()` are frontend-compatible**

#### `registry.ts` (22 lines)
Singleton cache wrapping `loadContentDir()`. Server-only because it depends on `loader.ts`'s fs operations.
- **Server-only, but unnecessary in frontend** -- content would be pre-bundled or fetched from API

#### `exercise-syntax.ts` (271 lines)
A string constant (`EXERCISE_SYNTAX`) containing the full exercise syntax reference documentation. Used as context for the AI chat when generating exercises.
- **100% frontend-compatible** (it's just a string constant)

#### `parser.test.ts` (487 lines)
Comprehensive test suite using `bun:test`. Not needed in production bundle.

### Bundling Verdict

| File | Frontend-Compatible | Notes |
|------|-------------------|-------|
| `types.ts` | YES | Pure types, zero runtime |
| `exercise-schema.ts` | YES | Zod schemas, ~4 KB |
| `parser.ts` | YES | Pure parsing functions |
| `course-parser.ts` | YES | Uses `gray-matter` (browser-compatible) |
| `unit-parser.ts` | YES | Uses `gray-matter` + parser |
| `loader.ts` | PARTIAL | `getUnitLessons()` = YES; `loadContentDir()` = NO (uses Node.js `fs`) |
| `registry.ts` | NO | Depends on `fs`-based loader. Not needed in frontend |
| `exercise-syntax.ts` | YES | String constant |
| `parser.test.ts` | N/A | Test file, exclude from bundle |

---

## 5. `/repo/lib/languages.ts` -- Language Configuration

### Contents (59 lines)

- `getLanguageName(code)` -- uses `Intl.DisplayNames` (browser API, fully compatible)
- `languageFlags` -- static map of ISO 639-1 codes to emoji flag Unicode sequences (29 languages)
- `getLanguageFlag(code)` -- lookup from the map
- `supportedLanguages` -- maps ISO codes to JSON filenames (12 entries: en, es, de, fr, it, pt, ru, ar, hi, ko, zh, ja)

### Bundling Verdict

| Aspect | Verdict |
|--------|---------|
| **Can bundle with frontend?** | YES -- 100% browser-compatible. Uses `Intl.DisplayNames` which is supported in all modern browsers |
| **Size** | Negligible (~2 KB) |
| **Server-side processing?** | NONE |

---

## 6. `/repo/lib/constants.ts` -- App Constants

### Contents (3 lines)

```typescript
export const DEFAULT_PATH = "/chat";
export const DEFAULT_NATIVE_LANGUAGE = "en";
export const DEFAULT_AI_MODEL = "claude-sonnet-4-6";
```

### Bundling Verdict

| Aspect | Verdict |
|--------|---------|
| **Can bundle with frontend?** | YES |
| **Size** | Negligible |
| **Notes** | `DEFAULT_AI_MODEL` may need to be configurable or removed if AI calls go through an API proxy |

---

## 7. `/repo/lib/srs.ts` & `/repo/lib/srs-words.ts` -- SRS Algorithm

### `srs.ts` (68 lines) -- SM-2 Spaced Repetition Algorithm

Pure mathematical algorithm. **Zero server dependencies.** Functions:
- `calculateNextReview(state: SrsState, quality: Quality): SrsResult` -- implements SM-2 algorithm
- Quality scale: 0-5 (complete blackout to perfect)
- Card statuses: "new" -> "learning" -> "review"
- Graduation threshold: 3 repetitions
- Computes: easeFactor, interval (days), repetitions, status, nextReviewAt

### `srs-words.ts` (16 lines) -- SRS Word Extractor

Pure utility function:
- `extractSrsWords(exercise: Exercise): string[]` -- extracts and deduplicates SRS words from any exercise type
- Only imports from `lib/content/types` (TypeScript types)

### Where SRS Runs

| Usage Location | Server/Client | Description |
|---------------|---------------|-------------|
| `lib/actions/srs.ts` | **Server** (`"use server"`) | All SRS actions are server actions -- they read/write DB |
| `lib/actions/lesson.ts` | **Server** (`"use server"`) | `completeLesson()` calls `recordWordPractice()` server-side |
| `calculateNextReview()` | **Pure function** | Called from server actions, but the algorithm itself is stateless |

### Bundling Verdict

| Aspect | Verdict |
|--------|---------|
| **Can bundle with frontend?** | YES -- both files are 100% pure functions with no server dependencies |
| **Server-side processing?** | The algorithm is pure math. However, the SRS *state* (card data, review schedules) is stored in PostgreSQL and all mutations happen in server actions |
| **Recommended approach** | Bundle the algorithm. In a frontend-only app, store SRS card state in IndexedDB/localStorage instead of PostgreSQL. The `calculateNextReview()` function works identically client-side |
| **Size** | Negligible (~3 KB combined) |

---

## 8. `/repo/lib/colors.ts` -- Color Utilities

### Contents (15 lines)

- `UNIT_COLORS` -- 8-color palette array (green, blue, purple, orange, red, pink, teal, indigo)
- `getUnitColor(index: number): string` -- cycles through palette by index

### Bundling Verdict

| Aspect | Verdict |
|--------|---------|
| **Can bundle with frontend?** | YES -- trivial pure function |
| **Size** | Negligible |

---

## Overall Summary Table

| Asset | Size | Bundle with Frontend? | Needs API? | Server Processing? |
|-------|------|-----------------------|-----------|-------------------|
| `/content/*.md` (11 files) | 18 KB | YES (inline or `?raw` import) | Only for user-created content | None (parsing is pure TS) |
| `/words/*.json` (14 files) | 94 MB total | LAZY-LOAD per language (1.4-15 MB each) | For AI word lookup fallback | Seed-only; AI fallback needs API keys |
| `/public/*` (11 files) | 46 KB | YES (copy to `public/`) | No | None |
| `lib/content/types.ts` | ~6 KB | YES | No | None |
| `lib/content/exercise-schema.ts` | ~4 KB | YES | No | None |
| `lib/content/parser.ts` | ~9 KB | YES | No | None |
| `lib/content/course-parser.ts` | ~1 KB | YES | No | None |
| `lib/content/unit-parser.ts` | ~2.5 KB | YES | No | None |
| `lib/content/exercise-syntax.ts` | ~7 KB | YES | No | None |
| `lib/content/loader.ts` (getUnitLessons) | ~1 KB | YES (partial) | No | `loadContentDir()` uses `fs` (exclude) |
| `lib/content/registry.ts` | ~0.5 KB | NO (replace with static import) | No | Uses `fs` via loader |
| `lib/languages.ts` | ~2 KB | YES | No | None |
| `lib/constants.ts` | ~0.1 KB | YES | No | None |
| `lib/srs.ts` | ~2 KB | YES (pure algorithm) | No | None (state storage needs replacement) |
| `lib/srs-words.ts` | ~0.5 KB | YES | No | None |
| `lib/colors.ts` | ~0.4 KB | YES | No | None |

---

## Architecture Recommendations for Vite Rewrite

### What Can Be Fully Client-Side

1. **Content parsing pipeline** -- Import `parser.ts`, `unit-parser.ts`, `course-parser.ts` directly. These are pure functions that take markdown strings and return structured objects.

2. **Seed content** -- Import the 11 markdown files as raw strings using Vite's `?raw` imports. Parse at app startup or build time. Total: 18 KB.

3. **SRS algorithm** -- `calculateNextReview()` runs purely on the client. Store card state in IndexedDB.

4. **All utility modules** -- `languages.ts`, `colors.ts`, `constants.ts`, `exercise-schema.ts`, `exercise-syntax.ts`.

5. **Static assets** -- Copy `public/` as-is to Vite's `public/` directory.

### What Needs an API or Alternative Strategy

1. **Dictionary data (94 MB)** -- Lazy-load per language from `/public/words/{language}.json` or a CDN. Cache in IndexedDB after first load. Average ~6.7 MB per language.

2. **User-created content** -- The DB stores user-created units/courses. A frontend-only app needs either:
   - An API endpoint to fetch user content
   - A serverless function layer (e.g., Cloudflare Workers)
   - Give up user-created content for a static-only app

3. **AI features** -- Word lookup fallback (`generateObject()`), free-text exercise evaluation (`afterSubmitPrompt`), chat-based exercise generation -- all require server-side AI API keys. These MUST go through an API proxy.

4. **User authentication & state** -- Session management, user stats, lesson completions, SRS card persistence -- all currently in PostgreSQL. In a frontend-only app:
   - Use a BaaS (Supabase, Firebase) or
   - IndexedDB for local-only mode or
   - Keep a thin API layer

### What to Exclude

1. `lib/content/registry.ts` -- Replace with static imports
2. `lib/content/loader.ts` `loadContentDir()` -- Replace with build-time content bundling
3. `lib/db/seed-words.ts` / `lib/db/seed-content.ts` -- Server-only seed scripts
4. `lib/content/parser.test.ts` -- Test file
5. `public/next.svg`, `public/vercel.svg` -- Next.js branding

---

## TODO (Implementation Steps)

- [ ] 1. Set up Vite project with TypeScript, copy `tsconfig.json` settings
- [ ] 2. Copy all `public/` assets (minus `next.svg`, `vercel.svg`) to Vite `public/`
- [ ] 3. Copy `lib/content/types.ts`, `exercise-schema.ts`, `parser.ts`, `course-parser.ts`, `unit-parser.ts`, `exercise-syntax.ts` as-is
- [ ] 4. Copy `lib/srs.ts`, `lib/srs-words.ts`, `lib/languages.ts`, `lib/constants.ts`, `lib/colors.ts` as-is
- [ ] 5. Create a `content/` module that imports all `.md` files via `?raw` and exports parsed courses/units (replaces `loader.ts`/`registry.ts`)
- [ ] 6. Move dictionary JSONs to `public/words/` and create a lazy-loading service that fetches per-language and caches in IndexedDB
- [ ] 7. Create an IndexedDB-backed SRS state store to replace PostgreSQL-backed `srs_card` table
- [ ] 8. Create API proxy endpoints (or use a BaaS) for AI features: word lookup fallback, free-text evaluation, chat exercise generation
- [ ] 9. Decide on auth strategy: BaaS auth, or local-only (no auth), or thin API
- [ ] 10. Port React components (these are Next.js RSC/client components -- need to convert server components to client)
