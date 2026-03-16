# Client-Side Caching Strategy for Route Navigation

## Problem

When navigating to a route like `/units`, a skeleton (`loading.tsx`) is shown while the server component re-fetches data. If the user navigates away and comes back, the **entire fetch cycle repeats** — skeleton appears, data loads from scratch. There is no caching layer preserving previously loaded data.

---

## Root Cause Analysis

### 1. All pages are dynamic Server Components

Every page under `(main)/` calls `auth.api.getSession()` with `headers()`, which makes them **dynamic routes** (cannot be statically rendered). For example, `/units` (`app/(main)/units/page.tsx:16-23`):

```tsx
export default async function LearnPage() {
  const session = await auth.api.getSession({ headers: await headers() });
  const [standaloneUnits, ownedCourses] = await Promise.all([
    userId ? getStandaloneUnits(userId) : Promise.resolve([]),
    userId ? getUserOwnedCourses(userId) : Promise.resolve([]),
  ]);
  // ...
}
```

The same pattern exists across all `(main)` pages: `/chat`, `/words`, `/read`, `/settings`, and all `/units/*` sub-routes.

### 2. Next.js 15+ changed the router cache default

**This is the key change.** In Next.js 14, the client-side router cache had a `staleTime` of 30 seconds for dynamic pages (and 5 minutes for static). Starting with **Next.js 15**, the default was changed to `staleTime: 0` for **all** pages.

This means: every `<Link>` navigation or `router.push()` triggers a fresh server-side render. The `loading.tsx` skeleton is shown every single time because the RSC payload is never cached on the client.

The app is running **Next.js 16.1.6**, so this 0-staleTime default is active.

### 3. No client-side caching layer exists

- **No TanStack Query** (`@tanstack/react-query` is not installed)
- **No SWR** (not installed)
- **No global state management** (no Redux, Zustand, Jotai, or React Context for data)
- **No localStorage/sessionStorage caching** of fetched data
- **No service workers** for request caching

The only caching that exists is:
- `React.cache()` for session deduplication within a single request (`lib/auth-server.ts:5`)
- DB-level caching for expensive operations (word lookups, TTS audio)
- `revalidatePath()` calls in server actions for mutation invalidation
- `next: { revalidate: 3600 }` on the GitHub stars fetch only

### 4. Affected routes

All `(main)` routes are affected. Every page under `(main)/` is a dynamic server component:

| Route | Server-side fetches |
|-------|-------------------|
| `/units` | `getStandaloneUnits()` + `getUserOwnedCourses()` |
| `/units/browse` | `listCoursesWithLessonCounts()` + `getAvailableFilters()` + `getBrowsableUnits()` |
| `/units/[courseId]` | `getCourseWithContent()` + `getUserProgress()` |
| `/units/edit/[unitId]` | `getUnitForEdit()` |
| `/chat` | `getConversations()` |
| `/words` | `getSrsCards()` |
| `/read` | Fetches article list |
| `/settings` | `getUserPreferences()` |

Additionally, the **layout itself** (`app/(main)/layout.tsx:28-32`) fetches `getUserStatsData()` + `getSrsStats()` + `getGitHubStars()` on every render.

---

## Solution Options

### Option A: Next.js `staleTimes` Configuration (Simplest)

Next.js provides an experimental `staleTimes` config that restores client-side router caching:

```ts
// next.config.ts
const nextConfig: NextConfig = {
  experimental: {
    staleTimes: {
      dynamic: 30,  // Cache dynamic pages for 30 seconds
      static: 180,  // Cache static pages for 3 minutes
    },
  },
};
```

**How it works:** After visiting `/units`, the RSC payload (rendered HTML + data) is cached on the client for 30 seconds. Navigating away and back within 30s shows the cached version instantly (no skeleton). After 30s, next navigation triggers a fresh fetch.

**Pros:**
- 3-line configuration change, zero code modifications
- Works for ALL routes immediately
- Preserves the entire server component architecture
- Mutations still work: `router.refresh()` + `revalidatePath()` bypass the cache

**Cons:**
- Coarse-grained: same staleTime for all dynamic routes
- `experimental` flag (though stable in practice since Next.js 15)
- Data can be stale for up to N seconds (30s in example)
- No stale-while-revalidate — after staleTime expires, skeleton shows again
- No per-route or per-query control

### Option B: TanStack Query (Most Powerful)

Install `@tanstack/react-query` and convert data fetching to client-side hooks.

**Implementation pattern (hybrid with server components):**

1. Install `@tanstack/react-query`
2. Create `QueryClientProvider` in root layout
3. Create API endpoints or use server actions as query functions
4. Convert pages to pass server-fetched data as `initialData` to `useQuery`
5. Use `useMutation` + `queryClient.invalidateQueries()` for mutations

**Example conversion of `/units`:**
```tsx
// Server component fetches initial data
export default async function LearnPage() {
  const initialUnits = await getStandaloneUnits(userId);
  return <UnitsClient initialUnits={initialUnits} />;
}

// Client component uses TanStack Query with initialData
function UnitsClient({ initialUnits }) {
  const { data: units } = useQuery({
    queryKey: ['units', 'standalone'],
    queryFn: () => fetchUnitsAction(),
    initialData: initialUnits,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
```

**Pros:**
- Fine-grained per-query cache control (`staleTime`, `gcTime`)
- Stale-while-revalidate: shows cached data instantly while refetching in background
- Automatic background refetching (on window focus, on reconnect)
- `queryClient.invalidateQueries()` for surgical cache invalidation after mutations
- Devtools for debugging cache state
- Industry standard, massive ecosystem
- Solves the `course-manager.tsx` pattern cleanly (currently uses raw `useEffect`)

**Cons:**
- ~13KB bundle increase (gzipped)
- Significant refactoring: every page needs conversion
- Need to create query functions (API endpoints or wrapper around server actions)
- Adds architectural complexity
- Server actions can't be called directly from `queryFn` (need thin wrappers)

### Option C: SWR (Lighter Alternative)

Similar to TanStack Query but simpler. Made by Vercel (same team as Next.js).

**Pros:**
- Lighter (~4KB gzipped)
- Simpler API, less boilerplate
- Good Next.js integration
- Stale-while-revalidate built-in

**Cons:**
- Less powerful than TanStack Query (no `useMutation`, no devtools, less cache control)
- Still requires page-level refactoring
- Smaller ecosystem

### Option D: Hybrid — `staleTimes` Now + TanStack Query Incrementally

Apply `staleTimes` immediately for a global improvement, then adopt TanStack Query on specific pages that need more control.

---

## Recommendation: Option A (`staleTimes`)

For this codebase, **`staleTimes` is the most appropriate solution**. Here's why:

### 1. Architecture alignment
The entire app is built on server components with server actions. This is a well-designed pattern — data flows from server to client via props, mutations use server actions + `revalidatePath()` + `router.refresh()`. Introducing TanStack Query would require rearchitecting this flow for every page, which is a large and unnecessary refactoring effort.

### 2. The problem is specifically about router cache
The user isn't asking for background refetching, optimistic updates, or complex cache invalidation. The issue is simply: "going back to a page re-fetches from scratch." This is a direct consequence of `staleTime: 0` in Next.js 15+, and `staleTimes` is the exact config designed to solve it.

### 3. Mutation invalidation already works
Server actions already call `revalidatePath("/units")` after every mutation (11 calls in `lib/actions/units.ts` alone). Combined with `router.refresh()` in client components, the cache is properly invalidated when data changes. `staleTimes` doesn't break this — `revalidatePath` and `router.refresh()` bypass the client cache.

### 4. TanStack Query is overkill for this use case
TanStack Query shines when you need:
- Complex per-query cache policies
- Optimistic updates
- Parallel/dependent queries with caching
- Client-side pagination caching

This app doesn't need any of that. The data is simple (lists of units/courses), mutations are infrequent, and the server component pattern already handles the data flow cleanly.

### 5. One exception worth noting
The `course-manager.tsx` component (`app/(main)/units/course-manager.tsx:25-42`) already does client-side fetching with `useEffect` — this is a pattern TanStack Query would clean up nicely. But it's a single component, not worth adding a library for. If more client-side fetching patterns emerge, TanStack Query could be introduced incrementally later.

---

## Design Decisions

### Chosen staleTime values

| Route type | staleTime | Reasoning |
|-----------|-----------|-----------|
| Dynamic pages | **30 seconds** | Covers typical back-and-forth navigation (e.g., clicking into a unit and going back). Short enough that data doesn't feel stale. |
| Static pages | **180 seconds** | Landing page and auth pages rarely change, 3 minutes is safe. |

These values are configurable and can be tuned based on user feedback.

### Why not longer staleTime?

- 30s is a sweet spot: long enough for "navigate away, navigate back" flows, short enough that data stays fresh
- Mutations (`revalidatePath`, `router.refresh()`) bypass the cache anyway, so stale data is only an issue if **another session** modifies data (e.g., a unit is created via the AI chat while you're on `/words`)
- If 30s proves too short, it can be bumped to 60s with no risk

### Edge cases

1. **After creating a unit via chat**: The AI chat's `createUnit` tool already calls `revalidatePath("/units")` (`lib/ai/tools.ts`), so navigating to `/units` after chat will show fresh data regardless of staleTime.

2. **Multi-tab scenarios**: If user has `/units` open in two tabs and creates a unit in one, the other tab will show stale data for up to 30s. This is acceptable — `router.refresh()` or a page reload will fix it.

3. **Layout data (stats, streak)**: The `(main)` layout also re-fetches stats on every navigation. With `staleTimes`, layout data will also be cached for 30s. This is fine — stats don't change that frequently.

---

## Implementation Todo

1. **Add `staleTimes` to `next.config.ts`** — Set `dynamic: 30` and `static: 180` under `experimental.staleTimes`
2. **Test navigation behavior** — Verify `/units` loads from cache on back-navigation within 30s
3. **Verify mutations still work** — Confirm `revalidatePath` and `router.refresh()` bypass the cache
4. **Test across all (main) routes** — Check `/chat`, `/words`, `/read`, `/settings` as well
