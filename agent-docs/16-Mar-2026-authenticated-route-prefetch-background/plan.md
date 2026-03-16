# Background Route Prefetch After Authentication

## Goal

After a user is authenticated, proactively prefetch app routes so navigation feels instant, while ensuring the prefetch process runs in the background and does not block the main thread or user interactions.

## Codebase Research Findings

### 1) Authenticated layout entry points

Authenticated users primarily render through:

- `app/(main)/layout.tsx` (hard-authenticated area; redirects unauthenticated users to `/sign-in`)
- `app/(public-or-auth)/layout.tsx` (conditionally renders full authenticated shell when a session exists)

Both layouts already perform authenticated-only side effects (for example `PostHogIdentify`), making them natural integration points for background prefetch bootstrapping.

### 2) Existing navigation targets used by authenticated users

Primary app navigation links are defined in:

- `components/layout/sidebar.tsx`
- `components/layout/mobile-nav.tsx`

Current primary routes from those navs:

- `/chat`
- `/units`
- `/read`
- `/words`
- `/settings`

Additional static authenticated route discovered in flow:

- `/units/browse` (linked from `app/(main)/units/page.tsx` and `app/(main)/units/browse/page.tsx`)

### 3) Dynamic routes exist and cannot be globally prefetched without concrete params

Examples:

- `/chat/[id]`
- `/read/[id]`
- `/units/[courseId]`
- `/units/edit/[unitId]`
- `/lesson/[courseId]/[unitId]/[lessonIndex]`
- `/unit/[unitId]` (public-or-auth group)

Because `router.prefetch()` needs concrete hrefs, we can only globally prefetch deterministic/static routes unless we have actual IDs at runtime.

### 4) Existing caching context

`next.config.ts` already defines:

- `experimental.staleTimes.dynamic = 30`
- `experimental.staleTimes.static = 180`

This helps repeated navigation, but it does not warm routes before the first click. User request is specifically about proactive post-auth prefetch, so an explicit client prefetch queue is still needed.

### 5) Sign-in and onboarding flow implications

Sign-in/sign-up push users to a destination (`/onboarding` by default for new users). Onboarding is authenticated (`app/(auth)/onboarding/page.tsx`) but uses auth layout, not main layout shell. For immediate implementation scope, prefetch trigger in authenticated app shells covers most active navigation contexts; optional onboarding trigger can be considered after core behavior lands.

## Design Decisions

### Decision A: Add a dedicated client prefetch component

Create a small client-only component (e.g., `components/providers/background-route-prefetch.tsx`) that:

1. Receives/uses a static route list for authenticated top-level routes.
2. Schedules route prefetch calls one-by-one during idle time.
3. Cleans up scheduled callbacks when unmounted.

Why: isolates background scheduling logic, keeps layouts clean, and avoids mixing UI concerns with navigation performance behavior.

### Decision B: Use idle-time scheduling to avoid blocking the main thread

Scheduling strategy:

- Prefer `window.requestIdleCallback` for low-priority work.
- Fallback to `setTimeout` when idle callback is unavailable.
- Process one route per idle slot, then re-schedule next route.

Why: this guarantees prefetch happens opportunistically and yields between operations, minimizing any interaction impact.

### Decision C: Prefetch only deterministic routes in v1

Initial prefetch list:

- `/chat`, `/units`, `/units/browse`, `/read`, `/words`, `/settings`

Why: these are the stable, global destinations users click between most, and they do not require runtime identifiers.

### Decision D: Mount only for authenticated render paths

Mount prefetch component in:

- `app/(main)/layout.tsx`
- Authenticated branch of `app/(public-or-auth)/layout.tsx`

Why: prefetch should start only after auth and should not run for anonymous users.

### Decision E: Deduplicate and run once per tab session

Add a lightweight guard (module-level flag or `sessionStorage` key) so repeated layout mounts do not repeatedly queue the same prefetch list.

Why: avoids redundant work and repeated scheduling churn when route groups remount.

## Edge Cases and Notes

1. **Dynamic detail routes**: cannot be globally prewarmed without IDs; this is expected and not a regression.
2. **Dev mode behavior**: Next dev may not show full production prefetch gains; validation should also be done in production build.
3. **Network cost**: prefetch adds background requests; if needed later, we can gate on `navigator.connection.saveData` or very slow effective connection types.
4. **Router API variability**: ensure implementation aligns with current Next.js 16 `next/navigation` router behavior.
5. **No UI blocking requirement**: idle callback queueing + one-item batching directly addresses this requirement.

## Implementation Todo

1. Create `components/providers/background-route-prefetch.tsx` with an idle-scheduled queue that calls `router.prefetch()` route-by-route.
2. Define and export authenticated static route list for prefetch (include `/chat`, `/units`, `/units/browse`, `/read`, `/words`, `/settings`).
3. Add one-time-per-session guard so prefetch queue does not restart on every authenticated layout remount.
4. Mount the prefetch component in `app/(main)/layout.tsx` and authenticated branch of `app/(public-or-auth)/layout.tsx`.
5. Run `bun run lint` and fix any typing/lint issues.
6. Validate behavior manually: sign in, confirm no jank during interaction, then navigate across prefetched routes and verify improved first navigation responsiveness.
