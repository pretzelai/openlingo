# Research: My Units Markdown Editor on /units page

## 1. Current /units page architecture

The `/units` page (`app/(main)/units/page.tsx`) is a **server component** that renders three sections:

1. **Continue Learning** (`continue-learning.tsx`) - Shows courses the user is enrolled in
2. **My Units** (`standalone-units.tsx`) - Shows standalone units (no courseId) belonging to the user or public
3. **Browse Courses** (`course-browser.tsx`) - Filterable course grid

There's also a `+ New Unit` button that navigates to `/chat?prompt=...` to create units via AI.

### Data flow
- `page.tsx:19-31` fetches session, then parallel-fetches courses, filters, enrolled courses, and standalone units
- `getStandaloneUnits(userId)` at `lib/db/queries/courses.ts:303-327` queries units where `courseId IS NULL AND (createdBy = userId OR visibility = 'public')`
- Returns `StandaloneUnitInfo[]` (id, title, description, icon, color, targetLanguage, sourceLanguage, level, lessonCount)

### StandaloneUnits component (`standalone-units.tsx`)
- Client component that receives `StandaloneUnitInfo[]` as props
- Renders a grid of cards, each linking to `/unit/{unitId}`
- Shows icon, title, description, language, level, lesson count
- **No edit functionality exists** - it's purely a read-only list

## 2. Database: Unit schema

`lib/db/schema.ts:275-294`:
```
unit table:
  id (text, PK, auto UUID)
  courseId (text, FK -> course.id, nullable)
  title (text, not null)
  description (text, not null)
  icon (text, not null)
  color (text, not null)
  markdown (text, not null)       ← FULL MARKDOWN = single source of truth
  targetLanguage (text, not null)
  sourceLanguage (text, nullable)
  level (text, nullable)
  visibility (text, nullable)
  createdBy (text, FK -> user.id, nullable)
  createdAt (timestamp)
  updatedAt (timestamp)
```

**Critical design**: The `markdown` column stores the complete unit content. All other columns (title, description, icon, color, etc.) are **denormalized mirrors** extracted from markdown frontmatter. Lessons/exercises are NOT in separate tables - they're parsed on-the-fly via `parseUnitMarkdown()`.

## 3. Unit markdown parsing pipeline

### `parseUnitMarkdown(raw)` at `lib/content/unit-parser.ts:32-81`
1. Uses `gray-matter` to extract YAML frontmatter (unitTitle, description, icon, color, targetLanguage, sourceLanguage, level, courseId)
2. Regex-finds `---` delimited lesson metadata blocks in the body
3. Each lesson block gets its own YAML frontmatter parsed (lessonTitle, description, icon, color)
4. Exercise content between blocks is parsed by `parseExercisesFromMarkdown()`
5. Returns `ParsedUnit { title, description, icon, color, targetLanguage, sourceLanguage, level, courseId, lessons[] }`

### `parseExercisesFromMarkdown(content)` at `lib/content/parser.ts:20-45`
- Strips `//` comment lines
- Splits on `[type-tag]` boundaries
- Parses each block via `parseExercise()` dispatching by type
- Validates against Zod schemas in `lib/content/exercise-schema.ts`
- Supports 9 exercise types: multiple-choice, translation, fill-in-the-blank, matching-pairs, listening, word-bank, speaking, free-text, flashcard-review

### `EXERCISE_SYNTAX` at `lib/content/exercise-syntax.ts`
- 256-line reference document describing the full markdown syntax
- Used in AI system prompt for unit generation
- Could be shown to users as a syntax reference

## 4. How units are currently created (the `createUnit` AI tool)

`lib/ai/tools.ts:141-227`:
1. Receives `markdown` string (and optional `courseId`)
2. Strips code fences
3. Calls `parseUnitMarkdown(cleaned)` to validate
4. Falls back to user's targetLanguage preference if not in frontmatter
5. Inserts into `unit` table with all denormalized fields
6. Calls `revalidatePath("/units", "page")`
7. Returns success with unitId, metadata, stats

**This same logic will need to be reused for the "save edited markdown" flow.**

## 5. Authentication

- `lib/auth-server.ts` exports `getSession()` (cached) and `requireSession()` (throws if not authed)
- Server components: `await auth.api.getSession({ headers: await headers() })`
- Server actions: `await requireSession()` → `session.user.id`
- Client-side: `useSession` hook from `lib/auth-client.ts`
- Auth guard in `app/(main)/layout.tsx` redirects to `/sign-in` if no session

## 6. Existing UI patterns

### Components
- `components/ui/button.tsx` - Lingo-styled button with variants (primary, secondary, danger, ghost, outline)
- `components/ui/input.tsx` - Text input
- `components/ui/card.tsx` - Card wrapper
- No existing textarea or code editor component

### Styling
- Tailwind CSS 4 with custom lingo-* color tokens
- Duolingo-inspired design: rounded corners, shadow borders, green/blue accents
- Cards use `rounded-xl border-2 border-lingo-border bg-white shadow-[0_2px_0_0] shadow-lingo-border`

## 7. Key observations for implementation

1. **Only user-created units should be editable**: The `createdBy` field allows filtering. The standalone units query already separates user's own units from public ones, but the current component doesn't distinguish between them.

2. **The getStandaloneUnits query doesn't return the markdown**: It only returns metadata + lessonCount. We'll need a way to fetch the raw markdown for editing.

3. **No existing server action for updating units**: We need a new `updateUnit` server action that:
   - Validates ownership (createdBy === userId)
   - Parses the new markdown via `parseUnitMarkdown()`
   - Updates both the markdown column and all denormalized columns
   - Revalidates the cache

4. **The parsing can fail**: `parseUnitMarkdown()` can throw. The editor needs to show parsing errors to the user so they can fix their markdown.

5. **No need for a rich editor**: The user explicitly asked for manual markdown editing. A `<textarea>` with monospace font and syntax highlighting (optional) would suffice.

6. **The `StandaloneUnitInfo` type doesn't include `createdBy`**: We need to either add it or separate the query into "my units" vs "public units."

## 8. Files that will need changes

| File | Change |
|------|--------|
| `app/(main)/units/page.tsx` | Add "My Created Units" section, pass separate data |
| `app/(main)/units/standalone-units.tsx` | Modify or create new component for created units with edit button |
| `lib/db/queries/courses.ts` | Add query for user's own units (or modify existing), add query to fetch unit markdown by id |
| `lib/content/types.ts` | May need new type for editable unit info (with createdBy flag) |
| NEW: `app/(main)/units/my-created-units.tsx` | New component: list of user's created units with edit buttons |
| NEW: `app/(main)/units/unit-editor.tsx` | New component: markdown textarea editor with save/cancel |
| NEW: `lib/actions/units.ts` | New server action: `updateUnitMarkdown(unitId, markdown)` |
