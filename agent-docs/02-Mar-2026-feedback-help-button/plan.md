# Feedback / Help Button - Implementation Plan

## Research Summary

### Codebase Context
- **Framework:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4
- **Auth:** `better-auth` with email/password and Google OAuth. Client hook: `useSession()` from `@/lib/auth-client`. Server: `getSession()` from `@/lib/auth-server`.
- **DB:** PostgreSQL via Drizzle ORM. The `account` table has a `providerId` field (`"google"` for OAuth, `"credential"` for email/password).
- **Turnstile:** Fully integrated. Reusable `<Turnstile>` component at `components/auth/turnstile.tsx` and server-side verification at `lib/turnstile.ts`.
- **Slack webhook:** Already used in `lib/auth.ts` for new-user signup notifications via `process.env.SLACK_WEBHOOK`. Pattern: `fetch(SLACK_WEBHOOK, { method: "POST", body: JSON.stringify({ text: "..." }) })`.
- **UI:** Custom Duolingo-inspired design system. Components: `Button`, `Input` in `components/ui/`. No dedicated `Textarea` component — raw `<textarea>` elements are used throughout with consistent styling (`rounded-xl border-2 border-lingo-border focus:border-lingo-blue focus:outline-none`).
- **Layouts:** Root layout (`app/layout.tsx`) wraps everything. Auth pages use `(auth)/layout.tsx`. App pages use `(main)/layout.tsx` (requires session, has sidebar + mobile nav). Hybrid pages use `(public-or-auth)/layout.tsx`.

### Key Architecture Decisions

#### 1. Button Placement — Root Layout
The feedback button goes in `app/layout.tsx` (root layout) so it appears on **every page**: landing, auth, and in-app. It will be a floating action button (FAB) fixed to the bottom-right corner. This is a client component rendered inside the existing `<PostHogProvider>`.

#### 2. Two-Mode Behavior
- **Unauthenticated:** The floating button is visible. When clicked, the form shows a Turnstile widget, an email input, and a message textarea. The submit button is disabled until Turnstile verification succeeds. This matches the existing Turnstile pattern in sign-in/sign-up forms.
- **Authenticated:** The floating button is always visible. When clicked, the form shows only the message textarea — name and email are auto-populated from the session. No Turnstile required.

#### 3. Auth Provider Detection
When the user is authenticated, the server action queries the `account` table (`providerId` field) for the user to determine if they signed in via `"google"` or `"credential"` (email/password). This information is included in the Slack message.

#### 4. Server Action for Slack
A new server action `submitFeedback` in `lib/actions/feedback.ts` handles:
- Turnstile token verification (for unauthenticated users)
- Session detection and auth provider lookup (for authenticated users)
- Sending the formatted message to Slack via the webhook

#### 5. Positioning
- **Desktop:** Fixed bottom-right, `right-6 bottom-6`
- **Mobile (in-app):** Above the mobile nav bar (`bottom-20` to clear the 56px nav), right-aligned
- **Mobile (landing/auth pages):** Normal bottom-right since there's no mobile nav

To handle this, the component will detect if it's inside the main app layout (where mobile nav exists) and adjust position accordingly. We can use the pathname to determine this — if the user is authenticated (session exists), we shift up on mobile.

### Edge Cases & Considerations
- **SLACK_WEBHOOK not set:** The server action gracefully handles missing webhook — returns success but logs a warning. The button still renders (so we don't break the UI in dev).
- **Turnstile not configured:** If `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is not set, the Turnstile widget doesn't render and submission is allowed without it (matching existing dev-mode behavior).
- **Empty message:** Client-side validation prevents submitting an empty message.
- **Email validation:** Basic email format validation for unauthenticated users.
- **Rate limiting:** Not in scope for v1, but the Turnstile acts as a basic bot-protection layer for unauthenticated submissions.
- **Z-index:** The button and modal need to sit above the sidebar (z-30) and mobile nav (z-30). Using z-50 for the FAB and z-50 for the modal overlay.
- **Mobile keyboard:** When the textarea is focused on mobile, the keyboard opens. The modal should be scrollable.

### Slack Message Format

**Authenticated user:**
```
Feedback from: John Doe (john@example.com)
Auth method: Google OAuth
---
[user's message here]
```

**Unauthenticated user:**
```
Feedback from (not logged in): john@example.com
---
[user's message here]
```

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `components/feedback/feedback-button.tsx` | **Create** | Client component: floating button + modal with two modes |
| `lib/actions/feedback.ts` | **Create** | Server action: validate, detect auth, send to Slack |
| `app/layout.tsx` | **Modify** | Add `<FeedbackButton />` inside the body |
| `example.env.local` | **Modify** | Add `SLACK_WEBHOOK` entry |

## Implementation Todo List

1. **Create `lib/actions/feedback.ts`** — Server action with Turnstile verification, session detection, account provider lookup, and Slack webhook delivery
2. **Create `components/feedback/feedback-button.tsx`** — Client component with:
   - Floating "?" button (bottom-right, fixed position)
   - Modal/popover with conditional form fields based on auth state
   - Turnstile integration for unauthenticated users
   - Success/error states
   - Responsive positioning (accounts for mobile nav)
3. **Modify `app/layout.tsx`** — Import and render `<FeedbackButton />` inside the `<body>`
4. **Modify `example.env.local`** — Add `SLACK_WEBHOOK=` placeholder
