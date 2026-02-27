# Server-Side Logic Catalog for Frontend-Only Rewrite

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Database Schema (All Tables)](#2-database-schema)
3. [Authentication System](#3-authentication-system)
4. [Server Actions Catalog](#4-server-actions-catalog)
5. [API Routes Catalog](#5-api-routes-catalog)
6. [AI Integration Layer](#6-ai-integration-layer)
7. [Supporting Server Libraries](#7-supporting-server-libraries)
8. [Middleware / Proxy](#8-middleware--proxy)
9. [External Service Dependencies](#9-external-service-dependencies)
10. [Summary Classification Table](#10-summary-classification-table)

---

## 1. Architecture Overview

The application is a **Next.js** language-learning platform using:

- **Database**: PostgreSQL via Drizzle ORM (`lib/db/index.ts` -- `postgres` driver + `drizzle-orm/postgres-js`)
- **Auth**: `better-auth` library with Drizzle adapter, email/password + Google OAuth, Cloudflare Turnstile CAPTCHA
- **AI Providers**: Google Gemini (primary for content generation/translation), OpenAI (TTS/STT), Anthropic Claude (chat)
- **Object Storage**: Cloudflare R2 (via S3 SDK) for audio file caching
- **Server Actions**: Next.js `"use server"` functions called directly from client components (9 action files)
- **API Routes**: Next.js route handlers under `app/api/` (11 route files)

**Key design patterns:**
- All server actions call `requireSession()` for auth -- this reads headers from the Next.js request context
- DB access uses Drizzle ORM query builder throughout
- `revalidatePath()` calls are used for Next.js ISR cache invalidation (irrelevant in a frontend-only rewrite)
- Admin checks via `isAdminEmail()` comparing against `ADMIN_EMAILS` env var

---

## 2. Database Schema

**File**: `/repo/lib/db/schema.ts`

### Better Auth Tables (managed by the auth library)

| Table | PK | Key Columns | Purpose |
|---|---|---|---|
| `user` | `id` (text) | name, email, emailVerified, image, createdAt, updatedAt | User accounts |
| `session` | `id` (text) | token (unique), expiresAt, userId (FK->user), ipAddress, userAgent | Auth sessions |
| `account` | `id` (text) | accountId, providerId, userId (FK->user), accessToken, refreshToken, password | OAuth/credential accounts |
| `verification` | `id` (text) | identifier, value, expiresAt | Email verification tokens |

### Application Tables

| Table | PK | Key Columns | Purpose |
|---|---|---|---|
| `user_stats` | `userId` (FK->user) | currentStreak, longestStreak, lastPracticeDate (date), totalLessonsCompleted | Gamification stats per user |
| `user_preferences` | `userId` (FK->user) | nativeLanguage, targetLanguage, preferredModel, updatedAt | User settings |
| `user_course_enrollment` | `id` (uuid) | userId+courseId (unique), currentUnitId, currentLessonIndex | Course progress tracking |
| `lesson_completion` | `id` (uuid) | userId (FK->user), unitId (FK->unit), lessonIndex, perfectScore, completedAt | Individual lesson completions |
| `exercise_attempt` | `id` (uuid) | userId (FK->user), lessonCompletionId (FK), exerciseIndex, exerciseType, correct, userAnswer | Per-exercise results |
| `daily_activity` | `id` (uuid) | userId+date (unique), lessonsCompleted | Daily activity aggregation |
| `srs_card` | composite (word, language, userId) | translation, cefrLevel, pos, gender, exampleNative, exampleEnglish, status (new/learning/review), easeFactor, interval, repetitions, nextReviewAt, lastReviewedAt, createdAt | Spaced repetition flashcards |
| `dictionary_word` | `id` (uuid) | word+language (unique), pos, cefrLevel, englishTranslation, exampleSentenceNative, exampleSentenceEnglish, gender, wordFrequency, usefulForFlashcard | Pre-seeded dictionary |
| `word_cache` | `id` (uuid) | word+language (unique), baseForm, translation, pos, gender, cefrLevel, exampleNative, exampleEnglish | AI word lookup cache |
| `user_memory` | `id` (uuid) | userId+key (unique), value, createdAt, updatedAt | AI memory + prompt overrides |
| `course` | `id` (text) | title, sourceLanguage, targetLanguage, level, visibility, published, createdBy (FK->user) | Course container |
| `unit` | `id` (uuid) | courseId (FK->course, nullable), title, description, icon, color, markdown, targetLanguage, sourceLanguage, level, visibility, createdBy (FK->user) | Learning units (contains markdown with lessons/exercises) |
| `user_unit_library` | `id` (uuid) | userId+unitId (unique), addedAt | User's saved public units |
| `audio_cache` | `id` (uuid) | text+language (unique), r2Key, createdAt | TTS audio cache mapping |
| `chat_conversation` | `id` (uuid) | userId (FK->user), title, language, messages (JSONB), createdAt, updatedAt | Saved chat conversations |
| `article` | `id` (uuid) | userId (FK->user), sourceUrl, title, sourceLanguage, targetLanguage, cefrLevel, originalContent, translatedContent, status, translationProgress, totalParagraphs, errorMessage, wordCount, audioUrl, audioDurationSeconds, audioTimestamps, createdAt | Translated reading articles |

### Relations

- `course` has many `unit` (via `unit.courseId`)
- `unit` belongs to one `course` (nullable)

---

## 3. Authentication System

### Classification: **AUTH**

### Files

| File | Purpose |
|---|---|
| `/repo/lib/auth.ts` | Server-side `better-auth` instance configuration |
| `/repo/lib/auth-server.ts` | Server-side session helpers (`getSession`, `requireSession`) |
| `/repo/lib/auth-client.ts` | Client-side auth helpers (`signIn`, `signUp`, `signOut`, `useSession`) |
| `/repo/lib/turnstile-plugin.ts` | Cloudflare Turnstile CAPTCHA plugin for better-auth |
| `/repo/lib/turnstile.ts` | Turnstile token verification utility |
| `/repo/app/api/auth/[...all]/route.ts` | Catch-all auth route handler |

### `lib/auth.ts` -- Auth Configuration

```
betterAuth({
  baseURL: process.env.BETTER_AUTH_BASE_URL,
  database: drizzleAdapter(db, { provider: "pg", schema }),
  plugins: [turnstilePlugin()],
  emailAndPassword: { enabled: true },
  socialProviders: {
    google: { clientId, clientSecret }
  },
  databaseHooks: {
    user.create.after: async (user) => {
      // 1. Insert default user_stats row
      // 2. Insert default user_preferences (nativeLanguage = "en")
      // 3. Send Slack webhook notification (if SLACK_WEBHOOK env set)
    }
  }
})
```

**Key behaviors:**
- On user creation, auto-initializes `user_stats` and `user_preferences` rows
- Turnstile CAPTCHA required on `/sign-in/email` and `/sign-up/email` (custom plugin checks `x-turnstile-token` header)
- Google OAuth as social provider

### `lib/auth-server.ts` -- Session Helpers

- **`getSession()`**: Cached (React `cache()`) wrapper around `auth.api.getSession({ headers })` -- reads session from cookies via Next.js `headers()`
- **`requireSession()`**: Calls `getSession()`, throws `Error("Unauthorized")` if null. Used by ALL server actions and protected API routes.

### `app/api/auth/[...all]/route.ts`

Delegates all `/api/auth/*` requests to `better-auth`'s Next.js handler. Handles:
- `POST /api/auth/sign-in/email` -- email/password sign in
- `POST /api/auth/sign-up/email` -- email/password registration
- `POST /api/auth/sign-in/social` -- Google OAuth flow
- `POST /api/auth/sign-out` -- sign out
- `GET /api/auth/session` -- get current session
- Various other better-auth endpoints

---

## 4. Server Actions Catalog

All server actions use `"use server"` directive and are in `/repo/lib/actions/`.

---

### 4.1 `lib/actions/chat.ts` -- Chat Conversations

**Classification: DATA**

| Action | Params | DB Operations | Returns |
|---|---|---|---|
| `listConversations()` | none | SELECT id, title, language, updatedAt FROM chat_conversation WHERE userId = session.user.id ORDER BY updatedAt DESC | Array of conversation summaries |
| `getConversation(id)` | `id: string` | SELECT * FROM chat_conversation WHERE id = :id AND userId = session.user.id LIMIT 1 | Full conversation row or null |
| `createConversation(language, title, messages)` | `language: string, title: string, messages: unknown[]` | INSERT INTO chat_conversation (userId, language, title, messages) RETURNING id | Conversation ID string |
| `saveMessages(id, messages)` | `id: string, messages: unknown[]` | UPDATE chat_conversation SET messages = :messages, updatedAt = now() WHERE id = :id AND userId = session.user.id | void |
| `deleteConversation(id)` | `id: string` | DELETE FROM chat_conversation WHERE id = :id AND userId = session.user.id | void |

**Notes:** `createConversation` and `deleteConversation` call `revalidatePath("/chat", "layout")`.

---

### 4.2 `lib/actions/srs.ts` -- Spaced Repetition System

**Classification: DATA**

| Action | Params | DB Operations | Returns |
|---|---|---|---|
| `addWordToSrs(word, language, translation)` | word: string, language: string, translation: string | INSERT INTO srs_card (word, language, userId, translation, status='new', nextReviewAt=null) ON CONFLICT DO NOTHING | void |
| `addOrFailWord(word, language, translation)` | word: string, language: string, translation: string | SELECT FROM srs_card WHERE word+language+userId; if not exists: INSERT (status='learning', nextReviewAt=now()); if exists: calculate SM-2 with quality=0, UPDATE srs_card | `"added"` or `"failed"` |
| `bulkAddWordsToSrs(words, language)` | words: {word, translation}[], language: string | INSERT batch (up to 500/batch) INTO srs_card ON CONFLICT DO NOTHING | number (count) |
| `removeAllWordsFromSrs(language)` | language: string | DELETE FROM srs_card WHERE language = :lang AND userId = session.user.id | void |
| `removeWordFromSrs(word, language)` | word: string, language: string | DELETE FROM srs_card WHERE word+language+userId | void |
| `getDueCards(language?, limit=20)` | language?: string, limit?: number | SELECT FROM srs_card WHERE userId AND status IN (learning, review) AND nextReviewAt IS NOT NULL AND nextReviewAt <= now() ORDER BY nextReviewAt LIMIT :limit | Array of srs_card rows |
| `getScheduledCards(language?, limit=20)` | language?: string, limit?: number | SELECT FROM srs_card WHERE userId AND status IN (learning, review) AND nextReviewAt IS NOT NULL AND nextReviewAt > now() ORDER BY nextReviewAt LIMIT :limit | Array of srs_card rows |
| `getAllCards(language?)` | language?: string | SELECT FROM srs_card WHERE userId [AND language] ORDER BY createdAt | Array of srs_card rows |
| `reviewCard(word, language, quality)` | word: string, language: string, quality: Quality (0-5) | SELECT card, calculate SM-2, UPDATE srs_card SET easeFactor/interval/repetitions/status/nextReviewAt/lastReviewedAt | SrsResult object |
| `getSrsStats(language?)` | language?: string | 5 separate COUNT queries: total, due, new, learning, review | {total, due, new, learning, review, learned} |
| `getNewCards(language, limit=20)` | language: string, limit?: number | SELECT FROM srs_card WHERE userId+language AND status='new' ORDER BY createdAt ASC LIMIT | Array of srs_card rows |
| `introduceNewCards(language, count)` | language: string, count: number | SELECT new cards LIMIT count, then UPDATE status='learning', nextReviewAt=now() | Array of updated cards |
| `recordWordPractice(userId, word, language, translation, correct)` | userId, word, language, translation, correct (boolean) | SELECT existing card; if not exists: calculate SM-2 + INSERT; if exists: calculate SM-2 + UPDATE | void |
| `recordChatExerciseResult(exercise, correct, language)` | exercise: Exercise, correct: boolean, language: string | Extract SRS words from exercise, call recordWordPractice for each | void |

**Notes:**
- `recordWordPractice` is NOT a server action (no `"use server"` invocation itself) but is called from other server code with an explicit userId. It still runs server-side.
- SM-2 algorithm implemented in `/repo/lib/srs.ts` (pure function `calculateNextReview`).
- SRS word extraction is in `/repo/lib/srs-words.ts` (pure function `extractSrsWords`).

---

### 4.3 `lib/actions/prompts.ts` -- Prompt Templates & User Memory

**Classification: DATA**

| Action | Params | DB Operations | Returns |
|---|---|---|---|
| `getPrompts()` | none | SELECT FROM user_memory WHERE userId AND key LIKE 'prompt:%' | Array of `PromptWithOverride` (merges DB overrides with hardcoded PROMPT_DEFINITIONS) |
| `savePrompt(id, value)` | id: string, value: string | INSERT INTO user_memory (userId, key='prompt:'+id, value) ON CONFLICT UPDATE value | void |
| `resetPrompt(id)` | id: string | DELETE FROM user_memory WHERE userId AND key='prompt:'+id | void |
| `getMemory()` | none | SELECT FROM user_memory WHERE userId AND key='memory' LIMIT 1 | string (memory text or "") |
| `saveMemory(value)` | value: string | INSERT INTO user_memory (userId, key='memory', value) ON CONFLICT UPDATE value | void |
| `getUserPromptTemplate(userId, promptId)` | userId: string, promptId: string | SELECT FROM user_memory WHERE userId AND key='prompt:'+promptId LIMIT 1 | string (custom template or default) |

**Notes:** `getUserPromptTemplate` is a non-action helper (no `"use server"` directive needed since the file already has it). Takes userId directly, used by the chat API route.

---

### 4.4 `lib/actions/profile.ts` -- User Profile

**Classification: DATA**

| Action | Params | DB Operations | Returns |
|---|---|---|---|
| `getProfileData()` | none | SELECT FROM user_stats WHERE userId; SELECT FROM lesson_completion WHERE userId ORDER BY completedAt DESC LIMIT 10 | {user, stats, recentCompletions} |
| `updateNativeLanguage(language)` | language: string | INSERT INTO user_preferences (userId, nativeLanguage) ON CONFLICT UPDATE nativeLanguage | void |
| `getNativeLanguage(userId)` | userId: string | SELECT nativeLanguage FROM user_preferences WHERE userId | string or null |

**Notes:** `updateNativeLanguage` calls `revalidatePath` on `/chat`, `/prompts`, `/settings`.

---

### 4.5 `lib/actions/progress.ts` -- Learning Progress

**Classification: DATA**

| Action | Params | DB Operations | Returns |
|---|---|---|---|
| `getUserProgress(courseId)` | courseId: string | SELECT unit IDs for course, then SELECT lesson_completion rows for those units + userId | {completions: array} |
| `getUnitProgress(unitId)` | unitId: string | SELECT FROM lesson_completion WHERE userId AND unitId | {completions: array} |
| `getUserStatsData()` | none | SELECT FROM user_stats WHERE userId; if not exists: INSERT default row RETURNING | user_stats row |

---

### 4.6 `lib/actions/preferences.ts` -- User Preferences

**Classification: DATA**

| Action | Params | DB Operations | Returns |
|---|---|---|---|
| `getTargetLanguage(userId?)` | userId?: string | SELECT targetLanguage FROM user_preferences WHERE userId LIMIT 1 | string or null |
| `updateTargetLanguage(language)` | language: string | Validates against `supportedLanguages`; INSERT INTO user_preferences ON CONFLICT UPDATE targetLanguage | void |
| `getPreferredModel(userId?)` | userId?: string | SELECT preferredModel FROM user_preferences WHERE userId LIMIT 1 | string (model ID or DEFAULT_AI_MODEL) |
| `updatePreferredModel(model)` | model: string | Validates model against user's allowed models list; INSERT INTO user_preferences ON CONFLICT UPDATE preferredModel | void |

**Notes:** `updateTargetLanguage` and `updatePreferredModel` call `revalidatePath`.

---

### 4.7 `lib/actions/lesson.ts` -- Lesson Completion

**Classification: DATA**

| Action | Params | DB Operations | Returns |
|---|---|---|---|
| `completeLesson(input)` | `{unitId, lessonIndex, results: [{exerciseIndex, exerciseType, correct, userAnswer}], mistakeCount}` | Complex multi-step: 1) INSERT lesson_completion + SELECT unit row (parallel); 2) INSERT exercise_attempt rows; 3) Parse unit markdown to extract exercises; 4) For each result, extract SRS words and call recordWordPractice; 5) Upsert user_stats (streak calculation); 6) Upsert daily_activity (increment lessonsCompleted); 7) Auto-add public standalone unit to user_unit_library | `{perfectScore: boolean}` |

**Notes:** This is the most complex server action. It:
- Computes streaks via `computeStreak()` from `/repo/lib/game/streaks.ts`
- Runs SRS word practice for all exercises in parallel
- Auto-adds public standalone units to user's library on first practice
- Uses `getUnitLessons()` to parse markdown and extract exercise objects

---

### 4.8 `lib/actions/library.ts` -- User Unit Library

**Classification: DATA**

| Action | Params | DB Operations | Returns |
|---|---|---|---|
| `addUnitToLibrary(unitId)` | unitId: string | Verify unit exists + is public + not owned; INSERT INTO user_unit_library ON CONFLICT DO NOTHING | `{success: true}` or `{success: false, error}` |
| `removeUnitFromLibrary(unitId)` | unitId: string | DELETE FROM user_unit_library WHERE userId AND unitId | `{success: true}` |

---

### 4.9 `lib/actions/units.ts` -- Unit & Course CRUD + Visibility

**Classification: DATA**

| Action | Params | DB Operations | Returns |
|---|---|---|---|
| `updateUnitMarkdown(unitId, markdown)` | unitId: string, markdown: string | SELECT unit (verify ownership + visibility); Parse markdown; UPDATE unit SET title/description/icon/color/markdown/targetLanguage/sourceLanguage/level/updatedAt | `{success, title, lessonCount, exerciseCount}` or `{success: false, error}` |
| `deleteUnit(unitId)` | unitId: string | SELECT unit (verify ownership + visibility); DELETE FROM unit | `{success}` or `{success: false, error}` |
| `makeUnitPublic(unitId)` | unitId: string | SELECT unit (verify ownership); UPDATE unit SET visibility='public' | `{success}` or `{success: false, error}` |
| `makeUnitPrivate(unitId)` | unitId: string | Admin only; SELECT unit; UPDATE unit SET visibility=null | `{success}` or `{success: false, error}` |
| `makeCoursePublic(courseId)` | courseId: string | SELECT course (verify ownership); UPDATE course SET visibility='public' | `{success}` or `{success: false, error}` |
| `makeCoursePrivate(courseId)` | courseId: string | Admin only; SELECT course; UPDATE course SET visibility=null | `{success}` or `{success: false, error}` |
| `createCourse(data)` | `{title, sourceLanguage, targetLanguage, level}` | Validate fields; Generate slug+uuid ID; INSERT INTO course | `{success, courseId}` or `{success: false, error}` |
| `deleteCourse(courseId)` | courseId: string | SELECT course (verify ownership + visibility); UPDATE unit SET courseId=null WHERE courseId; DELETE FROM course | `{success}` or `{success: false, error}` |
| `addUnitToCourse(unitId, courseId)` | unitId, courseId: string | Verify course ownership + visibility; Verify unit ownership + not already in course; UPDATE unit SET courseId | `{success}` or `{success: false, error}` |
| `removeUnitFromCourse(unitId)` | unitId: string | Verify unit is in a course; Verify course ownership + visibility; UPDATE unit SET courseId=null | `{success}` or `{success: false, error}` |
| `fetchCourseManagementData(courseId)` | courseId: string | getCourseForManagement(courseId, userId, admin) + getUserOwnedStandaloneUnits(userId) | `{success, course, availableUnits}` or `{success: false, error}` |

**Notes:**
- Edit-lock pattern: public units/courses can only be edited/deleted by admins
- `createCourse` generates ID from slugified title + random 8-char UUID suffix
- `deleteCourse` detaches units (sets courseId=null) rather than deleting them

---

## 5. API Routes Catalog

All in `/repo/app/api/`.

---

### 5.1 `app/api/auth/[...all]/route.ts`

**Classification: AUTH**
**Methods**: GET, POST (catch-all)
**Auth**: Handled by better-auth internally

Delegates to `better-auth`'s Next.js handler. Handles all auth endpoints (sign-in, sign-up, sign-out, session, OAuth callbacks, etc.).

---

### 5.2 `app/api/chat/route.ts`

**Classification: AI**
**Method**: POST
**Auth**: `requireSession()`

**Request body**:
```json
{
  "messages": [...],       // AI SDK message array
  "language": "de",        // optional target language code
  "model": "claude-sonnet-4-6" // optional model ID
}
```

**Logic**:
1. Resolve language (from request, or user's targetLanguage preference, or fallback "en")
2. Resolve model (validate against user's allowed models, fallback to default)
3. Fetch in parallel: user's chat prompt template, user memory, native language
4. Interpolate system prompt with: target_language, native_language, memory, exercise_syntax, srs_reference
5. Create AI tools (see Section 6)
6. Call `streamText()` from AI SDK with model, system prompt, messages, tools, max 7 steps
7. Return streaming response via `toUIMessageStreamResponse()`

**Response**: Server-Sent Events stream (AI SDK UI message stream format)

**DB queries**:
- SELECT user_preferences.targetLanguage
- SELECT user_memory WHERE key='memory'
- SELECT user_preferences.nativeLanguage
- SELECT user_memory WHERE key LIKE 'prompt:chat-system'

---

### 5.3 `app/api/stt/route.ts`

**Classification: MEDIA**
**Method**: POST
**Auth**: None (no `requireSession()` call!)

**Request**: `multipart/form-data` with fields:
- `audio`: Blob (audio file)
- `language`: string (language code)

**Logic**: Calls OpenAI Whisper API (`openai.audio.transcriptions.create`) with model "whisper-1"

**Response**:
```json
{ "text": "transcribed text" }
```

**External service**: OpenAI Whisper STT

---

### 5.4 `app/api/tts/route.ts`

**Classification: MEDIA**
**Methods**: GET, POST

#### GET -- Retrieve cached audio
**Auth**: None
**Query params**: `key` (R2 storage key)
**Logic**: Fetch audio buffer from Cloudflare R2 via `getAudio(key)`
**Response**: Binary audio/mpeg with 1-year cache headers, or 404

#### POST -- Generate speech
**Auth**: None
**Request body**:
```json
{ "text": "string (max 4096 chars)", "language": "de" }
```
**Logic**:
1. Check `audio_cache` table for existing cached audio
2. If not cached: call OpenAI TTS (`gpt-4o-mini-tts`, voice "coral") with language-specific instructions
3. Upload generated MP3 to Cloudflare R2
4. Insert into `audio_cache` table
5. Return public URL (which is `/api/tts?key=...`)

**Response**:
```json
{ "url": "/api/tts?key=audio/de/abc123.mp3" }
```

**DB queries**: SELECT + INSERT audio_cache
**External services**: OpenAI TTS, Cloudflare R2

---

### 5.5 `app/api/word/lookup/route.ts`

**Classification: AI + DATA**
**Method**: GET
**Auth**: `requireSession()`

**Query params**: `word`, `language`

**Logic** (delegated to `lib/words.ts` -> `lookupWord`):
1. Look up in `dictionary_word` table (exact match, lowercase)
2. If not found: check `word_cache` table
3. If not cached: call AI (Gemini 2.5 Flash Lite via `generateObject`) to analyze word
4. Cache AI result in `word_cache` (fire and forget)

**Response**:
```json
{
  "found": true,
  "source": "dictionary" | "ai",
  "word": "string",
  "translation": "string",
  "pos": "noun",
  "gender": "masculine" | null,
  "cefrLevel": "B1" | null,
  "exampleNative": "string" | null,
  "exampleEnglish": "string" | null
}
```

**DB queries**: SELECT dictionary_word; SELECT word_cache; INSERT word_cache
**External service**: Google Gemini (AI word analysis)

---

### 5.6 `app/api/ai-prompt/route.ts`

**Classification: AI**
**Method**: POST
**Auth**: `requireSession()`

**Request body**:
```json
{ "prompt": "string" }
```

**Logic**: Calls `generateText()` with Gemini 2.5 Flash Lite model. Simple prompt-in, text-out.

**Response**:
```json
{ "result": "generated text" }
```

**External service**: Google Gemini

---

### 5.7 `app/api/articles/route.ts`

**Classification: DATA**
**Method**: GET
**Auth**: `requireSession()`

**Logic**: List all articles for current user, ordered by createdAt DESC

**Response**: Array of article summary objects (id, sourceUrl, title, sourceLanguage, targetLanguage, cefrLevel, status, translationProgress, totalParagraphs, wordCount, createdAt)

**DB query**: SELECT (12 columns) FROM article WHERE userId ORDER BY createdAt DESC

---

### 5.8 `app/api/articles/[id]/route.ts`

**Classification: DATA**
**Methods**: GET, DELETE
**Auth**: `requireSession()`

#### GET -- Get full article
**Logic**: SELECT * FROM article WHERE id AND userId
**Response**: Full article row or 404

#### DELETE -- Delete article
**Logic**: DELETE FROM article WHERE id AND userId
**Response**: `{ "success": true }`

---

### 5.9 `app/api/articles/[id]/status/route.ts`

**Classification: DATA**
**Method**: GET
**Auth**: `requireSession()`

**Logic**: SELECT status, translationProgress, totalParagraphs, title, errorMessage, createdAt FROM article WHERE id AND userId

**Response**: Article status object or 404

---

### 5.10 `app/api/articles/[id]/timestamps/route.ts`

**Classification: DATA**
**Method**: GET
**Auth**: `requireSession()`

**Logic**: SELECT audioUrl, audioTimestamps FROM article WHERE id AND userId. Parse timestamps JSON.

**Response**:
```json
{ "timestamps": [{ "word": "string", "start": 0.0, "end": 0.5 }, ...] }
```

---

### 5.11 `app/api/articles/[id]/audio/route.ts`

**Classification: MEDIA + AI**
**Methods**: GET, POST
**Auth**: `requireSession()`

#### GET -- Get existing audio URL
**Logic**: SELECT audioUrl FROM article. If "generating" -> return status. If key exists -> return public URL.
**Response**: `{ "audioUrl": "..." }` or `{ "status": "generating" }` or 404

#### POST -- Generate article audio
**Logic**:
1. SELECT full article row
2. If audio exists, return it
3. If already generating, return status
4. If no translated content, return 400
5. Mark article as "generating" (UPDATE audioUrl = "generating")
6. Fire-and-forget background generation:
   a. Parse translatedContent JSON into blocks
   b. Concatenate translated text (up to 4096 chars)
   c. Call OpenAI TTS (`gpt-4o-mini-tts`, voice "coral") with language-specific instructions
   d. Upload MP3 to Cloudflare R2 (`article-audio/{id}.mp3`)
   e. Transcribe the generated audio with Whisper for word-level timestamps
   f. Align Whisper words to original text via `alignWordsToOriginal()`
   g. UPDATE article SET audioUrl, audioDurationSeconds, audioTimestamps

**Response**: `{ "status": "generating" }` or `{ "audioUrl": "..." }`

**DB queries**: SELECT article; UPDATE article (multiple times)
**External services**: OpenAI TTS, OpenAI Whisper, Cloudflare R2

---

## 6. AI Integration Layer

### 6.1 `lib/ai/models.ts`

**Classification: AI**

**Provider Registry**: Creates instances of Google Generative AI, OpenAI, and Anthropic via AI SDK and registers them in a unified provider registry.

**Available Models**:
| Model ID | Label | Provider |
|---|---|---|
| `gemini-3-flash-preview` | Gemini 3 Flash | Google |
| `gemini-3-pro-preview` | Gemini 3 Pro | Google |
| `gemini-2.5-flash-lite` | Gemini 2.5 Flash Lite | Google |
| `gpt-4o` | GPT-4o | OpenAI |
| `gpt-4o-mini` | GPT-4o Mini | OpenAI |
| `claude-sonnet-4-6` | Claude Sonnet 4.6 | Anthropic |
| `claude-opus-4-6` | Claude Opus 4.6 | Anthropic |

**User model access**:
- Regular users: only `claude-sonnet-4-6`
- Admin users (email in `ADMIN_EMAILS` env): all models

**Key functions**:
- `getModel(id)` -- resolves model ID to AI SDK LanguageModel instance
- `isAdminEmail(email)` -- checks against ADMIN_EMAILS env var
- `getModelsForUser(email)` -- returns model list based on admin status

---

### 6.2 `lib/ai/tools.ts`

**Classification: AI + DATA**

**Function**: `createTools(userId: string, language?: string)` -- returns an object of AI SDK tools available to the chat model.

| Tool | Input Schema | DB Operations | Purpose |
|---|---|---|---|
| `readMemory` | `{}` (no params) | SELECT user_memory WHERE userId AND key='memory' | Read user's persistent memory |
| `addMemory` | `{text: string}` | SELECT existing memory, then INSERT/UPDATE user_memory with appended text | Append to user's memory |
| `rewriteAllMemory` | `{value: string}` | INSERT/UPDATE user_memory replacing entire value | Replace entire memory |
| `srs` | `{sql: string}` | Executes raw SQL against `srs_card` table only (validates table access via regex). Uses `client.unsafe(query, [userId])` where $1 = userId | Direct SQL access to SRS cards |
| `presentExercise` | `{markdown: string}` | None (parses markdown via `parseExercise`) | Parse and render an interactive exercise widget |
| `createUnit` | `{markdown: string, courseId?: string}` | SELECT user_preferences; INSERT INTO unit; INSERT INTO user_stats (on conflict do nothing) | Create a learning unit from markdown |
| `addWordsToSrs` | `{language, cefrLevel?, minFrequency?, maxFrequency?, limit?}` | SELECT FROM dictionary_word (filtered); INSERT INTO srs_card (batch 500) ON CONFLICT DO NOTHING | Bulk-add dictionary words to SRS deck |
| `switchLanguage` | `{target_language?, native_language?}` | INSERT/UPDATE user_preferences for targetLanguage and/or nativeLanguage | Change user's language settings |
| `readArticle` | `{url, cefrLevel?, targetLanguage?}` | SELECT existing article; INSERT new article; fire-and-forget `processTranslation()` | Translate a web article for reading |

**Security**: The `srs` tool validates SQL queries with regex:
- Must reference `srs_card` table
- Must NOT reference any other table (explicit blocklist of all other table names)
- Binds userId as `$1` parameter

**Notes on `createUnit` tool**:
- Parses unit markdown via `parseUnitMarkdown()`
- Strips code fences
- Falls back to user's targetLanguage preference if not in frontmatter
- Tool param `courseId` overrides frontmatter `courseId`
- Calls `revalidatePath("/units")`

**Notes on `readArticle` tool**:
- Lazy-imports `lib/article/process.ts` to avoid loading jsdom at chat boot time
- Checks for existing article with same URL+language+level
- Starts background translation (fire-and-forget)

---

## 7. Supporting Server Libraries

### 7.1 `lib/tts.ts` -- Text-to-Speech Generation

**Classification: MEDIA**

**Function**: `generateSpeech(text, language) -> Promise<string>` (returns URL)
- Checks `audio_cache` table for cached audio
- If not cached: generates via OpenAI TTS (gpt-4o-mini-tts, voice "coral"), uploads to R2, caches in DB
- Returns `/api/tts?key=...` URL

**DB**: SELECT + INSERT audio_cache
**External**: OpenAI TTS, Cloudflare R2

---

### 7.2 `lib/r2.ts` -- Cloudflare R2 Storage

**Classification: MEDIA**

- `uploadAudio(key, buffer)` -- PutObject to R2 bucket
- `getAudio(key) -> Buffer | null` -- GetObject from R2 bucket
- `getPublicUrl(key) -> string` -- Returns `/api/tts?key=...` (proxied through the app)

**External**: Cloudflare R2 via AWS S3 SDK

---

### 7.3 `lib/words.ts` -- Dictionary & Word Lookup

**Classification: AI + DATA**

| Function | Purpose | DB | External |
|---|---|---|---|
| `loadLanguageRaw(langCode)` | Load all dictionary words for a language | SELECT all dictionary_word WHERE language | None |
| `loadLanguage(langCode)` | Same but returns Map<string, WordEntry> | Same | None |
| `aiLookup(word, language)` | AI-powered word analysis with caching | SELECT word_cache; INSERT word_cache | Google Gemini (generateObject) |
| `lookupWord(word, language)` | Combined lookup: dictionary first, then AI | SELECT dictionary_word; delegates to aiLookup | Google Gemini |
| `getWordsByLevel(language, level)` | Get dictionary words at a CEFR level | SELECT dictionary_word WHERE language AND cefrLevel | None |

---

### 7.4 `lib/srs.ts` -- SM-2 Algorithm

**Classification: DATA (pure logic)**

- `calculateNextReview(state: SrsState, quality: Quality) -> SrsResult` -- Pure function implementing the SM-2 spaced repetition algorithm
- No DB or external calls -- this is pure computation

---

### 7.5 `lib/article/` -- Article Processing Pipeline

**Classification: CONTENT + AI**

| File | Functions | Purpose |
|---|---|---|
| `fetch.ts` | `fetchArticleHtml(url, articleId)` | Fetches article HTML: tries direct fetch first, falls back to Jina Reader API |
| `extract.ts` | `extractArticleContent(html, url)`, `smartChunkContent(content)`, `countWords(text)`, `getSiteConfig(url)` | Extracts article text from HTML (uses Readability), chunks for translation |
| `translate.ts` | `detectLanguage(text)`, `translateChunk(text, targetLanguage, cefrLevel, options?)` | Detects language via Gemini, translates chunks via Gemini 3 Flash Preview |
| `process.ts` | `processTranslation(articleId, url, targetLanguage, cefrLevel)` | Orchestrates the full pipeline: fetch -> extract -> translate (parallel waves of 15) -> save progress |
| `types.ts` | Type definitions | `TranslationBlock { original, translated, bridge? }` |
| `cefr-guidelines.ts` | `getCefrGuidelines(language, level)` | Returns language-specific CEFR guidelines text for translation prompts |

**DB queries in process.ts**: Multiple UPDATE article calls (status transitions: fetching -> translating -> completed/failed, progress updates)
**External services**: Jina Reader API (fallback fetch), Google Gemini (translation + language detection)

---

### 7.6 `lib/content/` -- Content Parsing

**Classification: CONTENT (pure logic)**

| File | Purpose |
|---|---|
| `loader.ts` | `getUnitLessons(markdown)`, `getUnitLessonsSafe(markdown)`, `loadContentDir()` -- parses unit markdown, scans content directory |
| `unit-parser.ts` | `parseUnitMarkdown(markdown)` -- parses YAML frontmatter + lesson sections + exercises |
| `course-parser.ts` | `parseCourseMarkdown(markdown)` -- parses course markdown files |
| `parser.ts` | `parseExercise(markdown)` -- parses individual exercise markdown blocks |
| `exercise-schema.ts` | Zod schemas for exercise types |
| `exercise-syntax.ts` | EXERCISE_SYNTAX constant -- exercise markdown format documentation |
| `registry.ts` | Exercise type registry |
| `types.ts` | TypeScript type definitions |

**Notes**: These are all pure parsing functions with no DB or external calls. They could run client-side in a frontend-only rewrite since they just parse markdown.

---

### 7.7 `lib/db/queries/courses.ts` -- Course Query Helpers

**Classification: DATA**

| Function | Params | Purpose | DB Operations |
|---|---|---|---|
| `listCourses(filters?, userId?)` | filters: {sourceLanguage?, targetLanguage?, level?}, userId? | List published courses visible to user | SELECT course LEFT JOIN unit with visibility filtering, GROUP BY |
| `listCoursesWithLessonCounts(filters?, userId?)` | same | Same + accurate lesson counts | Calls listCourses, then SELECT units to parse markdown for lesson counts |
| `getCourseWithContent(courseId, userId?)` | courseId, userId? | Full course with parsed units | SELECT course + SELECT units, parse each unit's markdown |
| `getAvailableFilters(userId?)` | userId? | Get distinct filter values | SELECT DISTINCT sourceLanguage, targetLanguage, level FROM course |
| `getStandaloneUnits(userId)` | userId | User's units (owned + library) | SELECT user_unit_library; SELECT units (owned OR in library, standalone); SELECT lesson_completion counts |
| `getBrowsableUnits(userId)` | userId | Public standalone units not in user's library | SELECT user_unit_library; SELECT public standalone units not owned/in library |
| `getUnitForEdit(unitId, userId, isAdmin?)` | unitId, userId, isAdmin | Get unit for editing (with permission checks) | SELECT unit with ownership/visibility checks |
| `getUnitWithContent(unitId)` | unitId | Get unit with parsed lessons | SELECT unit, parse markdown |
| `getUserOwnedCourses(userId)` | userId | User's courses with stats | SELECT courses with unit counts + completion counts + lesson counts |
| `getCourseForManagement(courseId, userId, isAdmin)` | courseId, userId, isAdmin | Course management data | SELECT course, SELECT units with lesson counts |
| `getUserOwnedStandaloneUnits(userId)` | userId | Standalone units for course assignment | SELECT units WHERE createdBy AND courseId IS NULL |

---

## 8. Middleware / Proxy

### `proxy.ts`

**Classification: DATA (infrastructure)**

A Next.js middleware function that:
1. Reads the current request pathname
2. Sets it as an `x-pathname` header on the request
3. Passes through to `NextResponse.next()`

**Matcher**: All routes except static files and API routes.

**Notes**: This file appears to be standalone and is not currently imported anywhere (no `middleware.ts` file found). It may be legacy or unused. The `x-pathname` header would allow server components to know the current URL path.

---

## 9. External Service Dependencies

| Service | Used By | Purpose | Env Vars |
|---|---|---|---|
| **PostgreSQL** | All DB operations | Primary database | `DATABASE_URL` |
| **Google Gemini** | Chat, word lookup, article translation, language detection, AI prompt | AI text generation | `GOOGLE_AI_API_KEY` |
| **OpenAI** | TTS, STT, article audio | Speech synthesis & transcription | `OPENAI_API_KEY` |
| **Anthropic** | Chat | AI text generation (Claude models) | `ANTHROPIC_API_KEY` |
| **Cloudflare R2** | TTS cache, article audio | Object storage for audio files | `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` |
| **Google OAuth** | Auth | Social login | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| **Cloudflare Turnstile** | Auth | CAPTCHA on sign-up/sign-in | (via `turnstile.ts`) |
| **Jina Reader** | Article fetching | Fallback web content extraction | `JINA_API_KEY` |
| **Slack** | User signup hook | New user notifications | `SLACK_WEBHOOK` |

---

## 10. Summary Classification Table

### Server Actions (34 total)

| # | File | Action | Classification | Auth | DB Writes | External API |
|---|---|---|---|---|---|---|
| 1 | chat.ts | `listConversations` | DATA | Yes | No | No |
| 2 | chat.ts | `getConversation` | DATA | Yes | No | No |
| 3 | chat.ts | `createConversation` | DATA | Yes | INSERT | No |
| 4 | chat.ts | `saveMessages` | DATA | Yes | UPDATE | No |
| 5 | chat.ts | `deleteConversation` | DATA | Yes | DELETE | No |
| 6 | srs.ts | `addWordToSrs` | DATA | Yes | INSERT | No |
| 7 | srs.ts | `addOrFailWord` | DATA | Yes | SELECT+INSERT/UPDATE | No |
| 8 | srs.ts | `bulkAddWordsToSrs` | DATA | Yes | INSERT (batched) | No |
| 9 | srs.ts | `removeAllWordsFromSrs` | DATA | Yes | DELETE | No |
| 10 | srs.ts | `removeWordFromSrs` | DATA | Yes | DELETE | No |
| 11 | srs.ts | `getDueCards` | DATA | Yes | No | No |
| 12 | srs.ts | `getScheduledCards` | DATA | Yes | No | No |
| 13 | srs.ts | `getAllCards` | DATA | Yes | No | No |
| 14 | srs.ts | `reviewCard` | DATA | Yes | SELECT+UPDATE | No |
| 15 | srs.ts | `getSrsStats` | DATA | Yes | No | No |
| 16 | srs.ts | `getNewCards` | DATA | Yes | No | No |
| 17 | srs.ts | `introduceNewCards` | DATA | Yes | SELECT+UPDATE | No |
| 18 | srs.ts | `recordWordPractice` | DATA | (userId param) | SELECT+INSERT/UPDATE | No |
| 19 | srs.ts | `recordChatExerciseResult` | DATA | Yes | (delegates) | No |
| 20 | prompts.ts | `getPrompts` | DATA | Yes | No | No |
| 21 | prompts.ts | `savePrompt` | DATA | Yes | INSERT/UPDATE | No |
| 22 | prompts.ts | `resetPrompt` | DATA | Yes | DELETE | No |
| 23 | prompts.ts | `getMemory` | DATA | Yes | No | No |
| 24 | prompts.ts | `saveMemory` | DATA | Yes | INSERT/UPDATE | No |
| 25 | profile.ts | `getProfileData` | DATA | Yes | No | No |
| 26 | profile.ts | `updateNativeLanguage` | DATA | Yes | INSERT/UPDATE | No |
| 27 | progress.ts | `getUserProgress` | DATA | Yes | No | No |
| 28 | progress.ts | `getUnitProgress` | DATA | Yes | No | No |
| 29 | progress.ts | `getUserStatsData` | DATA | Yes | No/INSERT | No |
| 30 | preferences.ts | `getTargetLanguage` | DATA | Yes | No | No |
| 31 | preferences.ts | `updateTargetLanguage` | DATA | Yes | INSERT/UPDATE | No |
| 32 | preferences.ts | `getPreferredModel` | DATA | Yes | No | No |
| 33 | preferences.ts | `updatePreferredModel` | DATA | Yes | INSERT/UPDATE | No |
| 34 | lesson.ts | `completeLesson` | DATA | Yes | INSERT (multiple) + UPDATE | No |
| 35 | library.ts | `addUnitToLibrary` | DATA | Yes | INSERT | No |
| 36 | library.ts | `removeUnitFromLibrary` | DATA | Yes | DELETE | No |
| 37 | units.ts | `updateUnitMarkdown` | DATA | Yes | SELECT+UPDATE | No |
| 38 | units.ts | `deleteUnit` | DATA | Yes | SELECT+DELETE | No |
| 39 | units.ts | `makeUnitPublic` | DATA | Yes | SELECT+UPDATE | No |
| 40 | units.ts | `makeUnitPrivate` | DATA | Yes (admin) | SELECT+UPDATE | No |
| 41 | units.ts | `makeCoursePublic` | DATA | Yes | SELECT+UPDATE | No |
| 42 | units.ts | `makeCoursePrivate` | DATA | Yes (admin) | SELECT+UPDATE | No |
| 43 | units.ts | `createCourse` | DATA | Yes | INSERT | No |
| 44 | units.ts | `deleteCourse` | DATA | Yes | UPDATE+DELETE | No |
| 45 | units.ts | `addUnitToCourse` | DATA | Yes | SELECT+UPDATE | No |
| 46 | units.ts | `removeUnitFromCourse` | DATA | Yes | SELECT+UPDATE | No |
| 47 | units.ts | `fetchCourseManagementData` | DATA | Yes | (delegates) | No |

### API Routes (11 route files, 15 endpoints)

| # | Path | Method | Classification | Auth | DB | External API |
|---|---|---|---|---|---|---|
| 1 | `/api/auth/[...all]` | GET/POST | AUTH | better-auth | Yes (auth tables) | Google OAuth, Turnstile |
| 2 | `/api/chat` | POST | AI | Yes | SELECT (preferences, memory) | Google/OpenAI/Anthropic (streaming) |
| 3 | `/api/stt` | POST | MEDIA | **No** | No | OpenAI Whisper |
| 4 | `/api/tts` (GET) | GET | MEDIA | **No** | No | Cloudflare R2 |
| 5 | `/api/tts` (POST) | POST | MEDIA | **No** | SELECT+INSERT audio_cache | OpenAI TTS, Cloudflare R2 |
| 6 | `/api/word/lookup` | GET | AI+DATA | Yes | SELECT dictionary_word, word_cache; INSERT word_cache | Google Gemini |
| 7 | `/api/ai-prompt` | POST | AI | Yes | No | Google Gemini |
| 8 | `/api/articles` | GET | DATA | Yes | SELECT article | No |
| 9 | `/api/articles/[id]` (GET) | GET | DATA | Yes | SELECT article | No |
| 10 | `/api/articles/[id]` (DELETE) | DELETE | DATA | Yes | DELETE article | No |
| 11 | `/api/articles/[id]/status` | GET | DATA | Yes | SELECT article | No |
| 12 | `/api/articles/[id]/timestamps` | GET | DATA | Yes | SELECT article | No |
| 13 | `/api/articles/[id]/audio` (GET) | GET | MEDIA | Yes | SELECT article | No |
| 14 | `/api/articles/[id]/audio` (POST) | POST | MEDIA+AI | Yes | SELECT+UPDATE article | OpenAI TTS, Whisper, R2 |

### AI Tools (8 tools, invoked by the chat model)

| # | Tool | Classification | DB | External API |
|---|---|---|---|---|
| 1 | `readMemory` | DATA | SELECT user_memory | No |
| 2 | `addMemory` | DATA | SELECT+INSERT/UPDATE user_memory | No |
| 3 | `rewriteAllMemory` | DATA | INSERT/UPDATE user_memory | No |
| 4 | `srs` | DATA | Raw SQL on srs_card | No |
| 5 | `presentExercise` | CONTENT | No | No |
| 6 | `createUnit` | DATA | SELECT user_preferences; INSERT unit, user_stats | No |
| 7 | `addWordsToSrs` | DATA | SELECT dictionary_word; INSERT srs_card (batched) | No |
| 8 | `switchLanguage` | DATA | INSERT/UPDATE user_preferences | No |
| 9 | `readArticle` | CONTENT+AI | SELECT+INSERT article | Jina Reader, Google Gemini |

### By Classification Summary

| Category | Count | Description |
|---|---|---|
| **AUTH** | 1 route + auth config + turnstile | Authentication, session management, OAuth, CAPTCHA |
| **DATA** | 47 server actions + 6 route endpoints + 6 AI tools + 11 query helpers | CRUD operations on all application tables |
| **AI** | 3 route endpoints + 9 AI tool definitions + word lookup + article translation | LLM chat, text generation, word analysis, article translation |
| **MEDIA** | 4 route endpoints + TTS library + R2 library | Speech synthesis, speech recognition, audio storage |
| **CONTENT** | Content parsing library (pure functions) + 1 AI tool | Markdown parsing, exercise parsing -- could run client-side |

---

## Design Decisions & Edge Cases for Rewrite

1. **Auth migration**: The app uses `better-auth` with cookie-based sessions. In a frontend-only rewrite, you would need a separate backend auth service or use a hosted auth provider (Supabase Auth, Clerk, Auth0, etc.). The Turnstile CAPTCHA integration and the user-creation hook (auto-initializing user_stats and user_preferences) need to be replicated.

2. **Server Actions -> REST/RPC API**: All 47 server actions would need to become API endpoints. They all follow a consistent pattern of `requireSession()` + DB query + optional `revalidatePath()`. The `revalidatePath` calls can be dropped entirely.

3. **Streaming chat**: The `/api/chat` route uses AI SDK's `streamText` + `toUIMessageStreamResponse()` for Server-Sent Events streaming. This must remain server-side (proxied through a backend) since it holds API keys and manages tools.

4. **AI tools run server-side**: The 8 AI tools are executed server-side during chat. They have direct DB access and must remain behind an API. The `srs` tool is particularly sensitive as it executes raw SQL.

5. **Fire-and-forget patterns**: Article translation (`processTranslation`) and article audio generation (`generateAudioInBackground`) use fire-and-forget patterns that run after the HTTP response is sent. These need a job queue or background worker in a frontend-only architecture.

6. **Unprotected routes**: `/api/stt` and `/api/tts` have NO authentication. In a rewrite, consider whether to add auth or keep them open.

7. **R2 audio proxy**: Audio is served through `/api/tts?key=...` which proxies from R2. In a frontend-only rewrite, you could use R2 public URLs or a CDN instead.

8. **Content parsing is pure**: The `lib/content/` parsing libraries are pure functions that could run client-side, reducing the backend surface area.

9. **SM-2 algorithm is pure**: The SRS calculation (`lib/srs.ts`) is a pure function that could run client-side, with only the DB persistence needing to be server-side.

10. **Admin email checks**: Currently done via env var comparison. Would need a proper role system in a rewrite.

---

## Todo List (if implementing the rewrite)

- [ ] Design API schema for all 47 server actions (REST or tRPC)
- [ ] Design API schema for all 15 API route endpoints
- [ ] Migrate auth to a standalone auth service
- [ ] Create backend endpoints for all DATA operations
- [ ] Create backend endpoints for AI operations (chat streaming, word lookup, AI prompt)
- [ ] Create backend endpoints for MEDIA operations (TTS, STT, R2 proxy)
- [ ] Implement background job system for article translation and audio generation
- [ ] Move pure functions (content parsing, SM-2) to shared/client packages
- [ ] Implement proper admin role system
- [ ] Add auth to currently unprotected endpoints (STT, TTS)
- [ ] Replace `revalidatePath` calls with client-side cache invalidation
