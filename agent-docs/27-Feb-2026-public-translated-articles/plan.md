# Plan: Public Translated Articles

## Research Summary

### Current Public Units Architecture

The codebase has a well-established pattern for making units publicly accessible:

1. **Database**: `unit` table has `visibility: text("visibility")` column — `"public"` or `null` (private).
2. **Route group**: `app/(public-or-auth)/` provides a dual-mode layout — full app shell for authenticated users, minimal header with Sign In/Sign Up for anonymous visitors.
3. **Page-level access control**: The unit page at `app/(public-or-auth)/unit/[unitId]/page.tsx` uses `getSession()` (non-throwing) and checks `visibility === "public"` to decide whether anonymous access is allowed.
4. **Dual rendering**: Authenticated users see `<StandaloneUnitPath>` with full interactivity; anonymous users see `<PublicUnitPath>` with sign-up CTAs and locked lessons.
5. **Server actions**: `makeUnitPublic()` (owner-only), `makeUnitPrivate()` (admin-only) in `lib/actions/units.ts`.
6. **Discovery**: Browse page at `app/(main)/units/browse/` lists public units. `CopyLinkButton` for sharing URLs.
7. **SEO**: `generateMetadata` for OG tags, dynamic OG image at `/unit/[unitId]/og-image`.

### Current Translated Articles Architecture

- **Database**: `article` table in `lib/db/schema.ts:353-376` — has NO `visibility` column. All queries filter by `userId`.
- **Routes**: All under `app/(main)/read/` (auth-required). Reader page at `app/(main)/read/[id]/page.tsx` is a client component that fetches via `/api/articles/[id]`.
- **API endpoints**: All require `requireSession()` and filter by `article.userId`:
  - `GET/DELETE /api/articles/[id]` — full article data / delete
  - `GET /api/articles/[id]/audio` — get audio URL
  - `POST /api/articles/[id]/audio` — generate audio (fire-and-forget)
  - `GET /api/articles/[id]/timestamps` — word-level timestamps
- **Components**: `TranslatedText`, `AudioPlayer`, `ReadingMode` — all assume authenticated context.
- **Word interaction**: `WordSpan` -> `WordPopover` -> `WordTooltip` which calls `/api/word/lookup` (auth-required) and auto-calls `addOrFailWord()` (auth-required).

### Key Differences from Units

Unlike units (which are server components fetching data directly), the article reader is a **client component** that fetches data via API routes. This means we need public API routes (or a server-component-based public page) rather than just adjusting page-level access.

## Design Decisions

### 1. Database: Add `visibility` column to `article` table
Follow the same pattern as `unit` — nullable `text("visibility")` column where `"public"` means public and `null` means private. This requires a new Drizzle migration.

### 2. Public article page under `(public-or-auth)` route group
Create `app/(public-or-auth)/article/[id]/page.tsx` as a **server component** (following the unit pattern). This page:
- Uses `getSession()` (non-throwing)
- Fetches the article directly from DB (not through API routes)
- Checks visibility: public articles accessible to all, private only to owner
- Renders a different component for authenticated vs anonymous users

### 3. Public API routes for audio and timestamps
The article reader needs to fetch audio and timestamps via client-side requests. We need new public-access API routes:
- `GET /api/articles/[id]/public` — returns article data if `visibility === "public"` (no auth required)
- `GET /api/articles/[id]/public/audio` — returns audio URL for public articles (no auth required)
- `GET /api/articles/[id]/public/timestamps` — returns timestamps for public articles (no auth required)

### 4. Public word lookup API
Create `GET /api/word/public-lookup` that looks up words without requiring authentication and without saving to SRS. This lets anonymous users see translations when hovering words.

### 5. Modified `WordTooltip` for public context
Create a `PublicWordTooltip` variant (or add an `isPublic` prop to existing one) that:
- Uses the public word lookup endpoint
- Does NOT call `addOrFailWord()`
- Shows "Sign up to save to your words" instead of "Added to My Words"

### 6. "Make Public" button on articles list page
Add a "Make Public" button to article cards on the `/read` page (similar to standalone units). Only shown for completed articles owned by the user.

### 7. Server actions for article visibility
Add `makeArticlePublic()` and `makeArticlePrivate()` server actions following the unit pattern.

### 8. Browse public articles page
Add a browse section on the `/read` page or a separate `/read/browse` page where authenticated users can discover public articles from other users.

### 9. Copy link button on public articles
Show `CopyLinkButton` for public articles, linking to `/article/[id]`.

### 10. SEO metadata and OG image
Add `generateMetadata` and an OG image route for public articles (following the unit pattern).

## Edge Cases & Attention Points

1. **Audio generation**: Only the article owner can trigger audio generation (via `POST /api/articles/[id]/audio`). Public users can only listen to already-generated audio. The existing auth-protected POST route remains unchanged.

2. **In-progress articles**: Only completed articles can be made public. Articles with `status !== "completed"` should not have the "Make Public" option.

3. **Failed articles**: These obviously cannot be made public.

4. **Word lookup for anonymous users**: The public lookup endpoint should still use the AI/dictionary lookup but skip SRS operations. The existing `lookupWord()` function in `lib/words.ts` doesn't require auth — it's only the API route wrapper that does.

5. **Reading mode for anonymous users**: The `ReadingMode` component uses `WordPopover` which calls `addOrFailWord`. For anonymous users, we need to ensure this doesn't break. The public tooltip variant handles this.

6. **Edit locking**: Unlike units (which have editable markdown), articles are auto-generated and not manually editable. So there's no edit-lock concern. However, we should prevent deletion of public articles by non-admins, following the unit pattern.

7. **Article owner name**: We need to join with the `user` table to display the creator's name on public articles (similar to how browse units show creator names).

8. **The reader component is client-side**: The existing `/read/[id]/page.tsx` is a `"use client"` component that fetches everything via API. For the public page, we can either:
   - (a) Create a new server component that passes data as props to a shared client component
   - (b) Create public API routes and reuse the existing client component pattern
   
   **Decision**: Option (a) — server component fetches data and passes to a client component. This is cleaner, follows the unit pattern, and avoids duplicating API routes. The client component (`PublicArticleReader` or similar) receives all data as props instead of fetching.

## Implementation Todo List

### Phase 1: Database & Schema
- [ ] 1. Add `visibility` column to `article` table in `lib/db/schema.ts`
- [ ] 2. Generate Drizzle migration with `npx drizzle-kit generate`

### Phase 2: Server Actions
- [ ] 3. Add `makeArticlePublic()` server action in `lib/actions/units.ts` (or new `lib/actions/articles.ts`)
- [ ] 4. Add `makeArticlePrivate()` server action (admin-only)

### Phase 3: Public Word Lookup
- [ ] 5. Create `GET /api/word/public-lookup` route that calls `lookupWord()` without auth
- [ ] 6. Create `PublicWordTooltip` component (or modify `WordTooltip` with `isPublic` prop) that uses public lookup and shows "Sign up to save to your words"

### Phase 4: Public Article Components
- [ ] 7. Create a shared `ArticleReader` client component that can work in both authenticated and public contexts — receives article data, audio info, and an `isPublic` boolean as props
- [ ] 8. Modify `TranslatedText` / `WordSpan` to accept an optional `isPublic` prop that changes the word tooltip behavior

### Phase 5: Public Article Page
- [ ] 9. Create `app/(public-or-auth)/article/[id]/page.tsx` — server component with visibility check, fetches article from DB, renders `ArticleReader` with appropriate props
- [ ] 10. Add `generateMetadata` for SEO on the public article page
- [ ] 11. Create `app/(public-or-auth)/article/[id]/og-image/route.tsx` for dynamic OG images

### Phase 6: Audio for Public Articles
- [ ] 12. Create public audio API route `GET /api/articles/[id]/public-audio` that serves audio URL without auth (only for public articles)
- [ ] 13. Create public timestamps API route `GET /api/articles/[id]/public-timestamps` that serves timestamps without auth (only for public articles)

### Phase 7: Make Public UI on Article List
- [ ] 14. Add "Make Public" button and `CopyLinkButton` to the article reader page (`/read/[id]`) for completed articles owned by the user
- [ ] 15. Add "Make Public" / "Copy Link" / visibility indicators to article cards on the `/read` list page

### Phase 8: Browse Public Articles
- [ ] 16. Create a browse/discovery page or section for public articles (e.g., `/read/browse` or add to existing `/read` page)
- [ ] 17. Add a DB query to list public articles (similar to `getBrowsableUnits`)

### Phase 9: Testing & Polish
- [ ] 18. Ensure anonymous users can access public articles, hear audio, hover words, and see sign-up CTAs
- [ ] 19. Ensure private articles remain inaccessible to non-owners
- [ ] 20. Ensure only completed articles can be made public
- [ ] 21. Verify OG metadata works for sharing on social media
