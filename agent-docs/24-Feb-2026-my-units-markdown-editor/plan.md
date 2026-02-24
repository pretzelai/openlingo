# Plan: Enhanced My Units Section with Completion, Visibility, Author & Markdown Editor

## Overview

Rework the existing "My Units" (`StandaloneUnits`) section on the `/units` page to show richer information per unit card:
- **Completion status** (e.g. "3/5 lessons completed" with progress bar)
- **Visibility badge** (public / private)
- **Created by** (`user.name`)
- **Edit button** (only if `createdBy === current userId`) that links to a dedicated full-page editor at `/units/edit/[unitId]`

This is an enhancement of the existing `StandaloneUnits` component, not a separate section.

## Design Decisions

1. **Enhance, don't split**: Rather than creating a separate section, we enrich the existing "My Units" section. Every standalone unit card gets completion status, visibility, and author. Units created by the current user additionally get an "Edit" button.

2. **Completion data**: The `lessonCompletion` table tracks `userId + unitId + lessonIndex`. We need to join/query completion counts per unit for the current user and pass them alongside the unit data.

3. **Author name**: The `unit.createdBy` FK points to `user.id`. We need to join the `user` table to get `user.name` for the "Created by" label.

4. **Visibility**: The `unit.visibility` column is either `"public"` or `null` (private). We'll display a small badge.

5. **Full-page editor**: Clicking "Edit" on a unit you own redirects to `/units/edit/[unitId]` -- a dedicated full-page text editor for editing the raw markdown. This gives the user proper space to work with the markdown content, with save, cancel, and delete actions.

6. **Ownership for edit**: The server action validates `createdBy === session.user.id` before allowing updates. The edit page itself also validates ownership server-side and redirects away if the user doesn't own the unit. The client only shows the edit button when the prop `isOwner` is true.

## Architecture

```
page.tsx (server) — /units
  ├── ContinueLearning (enrolled courses)
  ├── StandaloneUnits (ENHANCED - completion, visibility, author, edit link)
  └── CourseBrowser (course grid)

/units/edit/[unitId]/page.tsx (NEW - server component)
  └── UnitEditor (NEW - client component, full-page markdown editor)

StandaloneUnits receives:
  - units: StandaloneUnitInfo[] (enhanced with completedLessons, visibility, creatorName, isOwner)

lib/actions/units.ts (NEW)
  ├── updateUnitMarkdown(unitId, markdown) → parse + update DB
  └── deleteUnit(unitId) → ownership check + delete

lib/db/queries/courses.ts (MODIFIED)
  ├── getStandaloneUnits(userId) → enhanced to join user table + completion counts
  └── getUnitForEdit(unitId, userId) → fetch unit with raw markdown (ownership validated)
```

## Implementation Steps

### Step 1: Enhance `StandaloneUnitInfo` type

**File**: `lib/content/types.ts`

Add new fields to `StandaloneUnitInfo`:

```ts
export interface StandaloneUnitInfo {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  targetLanguage: string;
  sourceLanguage: string | null;
  level: string | null;
  lessonCount: number;
  // NEW fields:
  completedLessons: number;
  visibility: string | null;     // "public" or null (private)
  creatorName: string | null;    // user.name of the creator
  isOwner: boolean;              // createdBy === current userId
}
```

### Step 2: Enhance `getStandaloneUnits` query + add `getUnitForEdit`

**File**: `lib/db/queries/courses.ts`

**Modify** `getStandaloneUnits(userId)` to:
1. **Join** `user` table on `unit.createdBy = user.id` to get `user.name`
2. **Subquery/count** `lessonCompletion` rows for the current `userId` per `unitId` to get `completedLessons`
3. **Select** `unit.visibility` and `unit.createdBy`
4. **Compute** `isOwner: u.createdBy === userId` in the mapping step
5. Return the enhanced `StandaloneUnitInfo[]`

The query will use a left join on the user table, and a separate query (or subquery) for completion counts to keep it clean. Completion counts come from:
```sql
SELECT unit_id, COUNT(*) as completed
FROM lesson_completion
WHERE user_id = $userId
GROUP BY unit_id
```

**Add** `getUnitForEdit(unitId, userId)`:
- Fetches the unit row including the raw `markdown` column
- Validates `createdBy === userId`
- Returns `{ id, title, markdown }` or `null` if not found / not owned

### Step 3: Create server actions for unit editing

**File**: `lib/actions/units.ts` (NEW)

Two server actions:

1. **`updateUnitMarkdown(unitId: string, markdown: string)`**:
   - `requireSession()` to get userId
   - Fetch unit row, verify `createdBy === userId`
   - Strip code fences (same logic as `createUnit` tool in `lib/ai/tools.ts:167-170`)
   - Call `parseUnitMarkdown(cleaned)`
   - On parse failure: return `{ success: false, error: "Failed to parse: ..." }`
   - On success: `db.update(unit).set(...)` with all denormalized fields + markdown + updatedAt
   - `revalidatePath("/units", "page")`
   - Return `{ success: true, title, lessonCount, exerciseCount }`

2. **`deleteUnit(unitId: string)`**:
   - `requireSession()` to get userId
   - Fetch unit row, verify `createdBy === userId`
   - `db.delete(unit).where(eq(unit.id, unitId))`
   - `revalidatePath("/units", "page")`
   - Return `{ success: true }`

### Step 4: Enhance `StandaloneUnits` component

**File**: `app/(main)/units/standalone-units.tsx`

Rework the existing component to show the new data per card:

**Card layout** (each unit):
- Left: icon block (existing)
- Center: title, description (existing) + new metadata row:
  - Language + level (existing)
  - Lesson count (existing)
  - Visibility badge: green "Public" or gray "Private"
  - "Created by: {creatorName}"
- Below metadata: completion progress bar (`completedLessons / lessonCount`)
- If `isOwner`: an "Edit" button/link in the card that navigates to `/units/edit/{unitId}`

The entire card still links to `/unit/{unitId}` for playing. The edit button is a separate element that stops propagation and navigates to the editor.

### Step 5: Create the full-page editor route

**New files**:
- `app/(main)/units/edit/[unitId]/page.tsx` — server component
- `app/(main)/units/edit/[unitId]/unit-editor.tsx` — client component

**Server component** (`page.tsx`):
- Calls `getUnitForEdit(unitId, userId)`
- If `null` (not found or not owned): `redirect("/units")`
- Renders `<UnitEditor unitId={id} title={title} initialMarkdown={markdown} />`

**Client component** (`unit-editor.tsx`):
- Full-page layout with:
  - Header: "Edit: {title}" + back link to `/units`
  - Full-width monospace `<textarea>` filling most of the viewport height
  - Bottom toolbar: "Save" (primary button), "Cancel" (outline button, links back to /units), "Delete" (danger button, far right)
  - Error message area (red text, shown when parse fails)
- State: `markdown` (textarea value), `saving` (loading), `deleting` (loading), `error` (string | null)
- On Save:
  - Call `updateUnitMarkdown(unitId, markdown)`
  - If `success`: redirect to `/units` (via `router.push`)
  - If `error`: display error message, stay on page
- On Delete:
  - `window.confirm("Are you sure?")`
  - Call `deleteUnit(unitId)`
  - Redirect to `/units`
- On Cancel: `router.push("/units")`

### Step 6: Wire into the /units page

**File**: `app/(main)/units/page.tsx`

Minimal changes since we're enhancing the existing component:
- The `getStandaloneUnits(userId)` call already exists in the parallel fetch
- The enhanced return type is backward-compatible in shape (new fields added)
- No new props needed on the page level

### Step 7: Verify

- Page loads with and without standalone units
- Cards show completion progress, visibility badge, creator name
- Edit button appears only on owned units and links to `/units/edit/{unitId}`
- Editor page loads with correct markdown pre-filled
- Save works: valid markdown updates DB and redirects to /units
- Save with invalid markdown: shows parse error inline, stays on page
- Delete works with confirmation dialog, redirects to /units
- Cancel returns to /units
- Non-owner navigating to `/units/edit/{unitId}` gets redirected to /units

## Todo List

- [ ] Enhance `StandaloneUnitInfo` type in `lib/content/types.ts`
- [ ] Enhance `getStandaloneUnits` query in `lib/db/queries/courses.ts` (join user, count completions)
- [ ] Add `getUnitForEdit` query in `lib/db/queries/courses.ts`
- [ ] Create `lib/actions/units.ts` with `updateUnitMarkdown`, `deleteUnit`
- [ ] Rework `app/(main)/units/standalone-units.tsx` to show completion, visibility, author, edit link
- [ ] Create `app/(main)/units/edit/[unitId]/page.tsx` server component
- [ ] Create `app/(main)/units/edit/[unitId]/unit-editor.tsx` client component (full-page editor)
- [ ] Update `app/(main)/units/page.tsx` if any prop changes needed
- [ ] Verify the full flow
