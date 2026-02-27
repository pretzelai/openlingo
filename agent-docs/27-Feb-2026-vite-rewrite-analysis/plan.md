# Comprehensive Frontend Code Catalog for Vite Rewrite

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Components Catalog](#components-catalog)
3. [Hooks Catalog](#hooks-catalog)
4. [App Pages & Layouts Catalog](#app-pages--layouts-catalog)
5. [Providers](#providers)
6. [Styling Approach](#styling-approach)
7. [Server Actions Dependency Map](#server-actions-dependency-map)
8. [API Routes Dependency Map](#api-routes-dependency-map)
9. [Next.js-Specific Feature Usage](#nextjs-specific-feature-usage)
10. [Design Decisions & Edge Cases](#design-decisions--edge-cases)
11. [Migration Todo List](#migration-todo-list)

---

## Executive Summary

The codebase is a **Next.js 16 App Router** language learning application ("OpenLingo") using:
- **React 19.2.3** with Server Components + Client Components
- **Tailwind CSS v4** (via `@tailwindcss/postcss`) with CSS custom properties
- **better-auth** for authentication (client SDK + server SDK)
- **Drizzle ORM** for database
- **AI SDK** (`@ai-sdk/react`, `ai`) for chat streaming
- **PostHog** for analytics
- **9 server actions** files in `lib/actions/`
- **11 API routes** in `app/api/`

### Key Findings

**Total files analyzed: 90+**

| Category | Count | "use client" | Server Component | Next.js Deps |
|----------|-------|-------------|-----------------|-------------|
| components/ | 49 | 35 | 14 | 17 |
| hooks/ | 5 | 5 | 0 | 0 |
| app/ pages | 21 | 1 | 20 | 20 |
| app/ layouts | 5 | 0 | 5 | 5 |
| app/ co-located client | 18 | 18 | 0 | 12 |

**Critical Next.js dependencies that must be replaced:**
- `next/link` (Link component) - used in ~18 files
- `next/navigation` (useRouter, usePathname, useSearchParams, redirect, notFound) - used in ~25 files
- `next/image` (Image component) - used in 2 files
- `next/script` (Script component) - used in 1 file
- `next/font/google` (font loading) - used in 1 file
- Server Actions ("use server") - 9 files, called from ~20 client components
- Server Components (async components with direct DB/auth access) - 20+ page files
- `headers()`, `cache()` from `next/headers` / `react` - used in auth & layouts
- `redirect()` / `notFound()` from `next/navigation` - used in 8+ server pages

---

## Components Catalog

### components/word/ (4 files)

#### `word-tooltip.tsx`
- **"use client"**: YES
- **Renders**: Word definition tooltip with translation, POS, gender, CEFR level, examples, SRS status
- **Hooks/State**: `useState` (data, loading, srsStatus), `useEffect` (fetch + auto-SRS)
- **Server Actions**: `addOrFailWord` from `@/lib/actions/srs` - called directly
- **API Calls**: `GET /api/word/lookup?word=...&language=...`
- **Next.js deps**: NONE
- **Data needs**: Word lookup API, SRS write

#### `hoverable-markdown.tsx`
- **"use client"**: YES
- **Renders**: Markdown text where each word is clickable to reveal a popover
- **Hooks/State**: `useState` (activeWord), `useCallback`
- **Dependencies**: `react-markdown`, `WordPopover`, `useAudio` hook
- **Next.js deps**: NONE

#### `word-popover.tsx`
- **"use client"**: YES
- **Renders**: Positioned popover (desktop) or bottom sheet (mobile) containing WordTooltip
- **Hooks/State**: `useEffect` (click outside, escape), `useRef`, `useCallback`
- **Dependencies**: `createPortal`, `useIsMobile` hook, `WordTooltip`
- **Next.js deps**: NONE

#### `hoverable-text.tsx`
- **"use client"**: YES
- **Renders**: Inline text where each word is clickable; supports inline markdown (**bold**, *italic*)
- **Hooks/State**: `useState` (activeWord), `useCallback`
- **Dependencies**: `WordPopover`, `useAudio` hook
- **Next.js deps**: NONE

### components/ui/ (6 files)

#### `progress-bar.tsx`
- **"use client"**: NO (server-compatible, stateless)
- **Renders**: Horizontal progress bar with optional percentage label
- **Next.js deps**: NONE

#### `badge.tsx`
- **"use client"**: NO (server-compatible, stateless)
- **Renders**: Colored badge pill
- **Next.js deps**: NONE

#### `button.tsx`
- **"use client"**: YES
- **Renders**: Styled button with variants (primary/secondary/danger/ghost/outline), sizes, loading state
- **Hooks**: `forwardRef`
- **Next.js deps**: NONE

#### `copy-link-button.tsx`
- **"use client"**: YES
- **Renders**: Button that copies a URL to clipboard
- **Hooks/State**: `useState` (copied)
- **Next.js deps**: NONE (uses `window.location.origin`)

#### `input.tsx`
- **"use client"**: YES
- **Renders**: Styled input with label + error display
- **Hooks**: `forwardRef`
- **Next.js deps**: NONE

#### `card.tsx`
- **"use client"**: NO (server-compatible, stateless)
- **Renders**: Basic card container
- **Next.js deps**: NONE

### components/learning-path/ (3 files)

#### `unit-card.tsx`
- **"use client"**: NO (server-compatible, but imports `HoverableText` which is "use client")
- **Renders**: Unit overview card with icon, progress, lessons count; two modes: clickable button or static with children
- **Next.js deps**: NONE

#### `lesson-node.tsx`
- **"use client"**: YES
- **Renders**: Individual lesson node in zigzag path (completed/current/locked states)
- **Dependencies**: `HoverableText`
- **Next.js deps**: `Link` from `next/link`

#### `path-connector.tsx`
- **"use client"**: NO (server-compatible, stateless)
- **Renders**: Vertical connector line between lesson nodes
- **Next.js deps**: NONE

### components/gamification/ (2 files)

#### `streak-flame.tsx`
- **"use client"**: NO (server-compatible, stateless)
- **Renders**: Streak count with flame emoji
- **Next.js deps**: NONE

#### `lesson-complete-modal.tsx`
- **"use client"**: YES
- **Renders**: Lesson completion celebration screen with trophy/confetti
- **Dependencies**: `Button`
- **Next.js deps**: NONE

### components/layout/ (3 files)

#### `sidebar.tsx`
- **"use client"**: YES
- **Renders**: Desktop sidebar navigation with 5 nav items
- **Hooks**: `usePathname()` for active state
- **Next.js deps**: `Link` from `next/link`, `usePathname` from `next/navigation`

#### `top-bar.tsx`
- **"use client"**: YES
- **Renders**: Top header with stats (streak, words), GitHub stars, sign out button
- **Hooks**: `useRouter()`, `useSession()` from auth-client
- **Dependencies**: `signOut` from `@/lib/auth-client`
- **Next.js deps**: `useRouter` from `next/navigation`

#### `mobile-nav.tsx`
- **"use client"**: YES
- **Renders**: Bottom mobile navigation bar, hides when keyboard is open
- **Hooks**: `usePathname()`, `useMobileKeyboardOpen()`
- **Next.js deps**: `Link` from `next/link`, `usePathname` from `next/navigation`

### components/onboarding/ (1 file)

#### `onboarding-form.tsx`
- **"use client"**: YES
- **Renders**: Language selection form (target + native language dropdowns)
- **Hooks/State**: `useState` (target, native, error), `useTransition`, `useRouter`
- **Server Actions**: `updateTargetLanguage`, `updateNativeLanguage` - called directly
- **Next.js deps**: `useRouter` from `next/navigation`

### components/providers/ (2 files)

#### `posthog.tsx`
- **"use client"**: YES
- **Renders**: PostHog provider wrapper + pageview tracker
- **Hooks**: `usePathname`, `useSearchParams`, `useEffect`
- **Dependencies**: `posthog-js`, `posthog-js/react`
- **Next.js deps**: `usePathname`, `useSearchParams` from `next/navigation`

#### `posthog-identify.tsx`
- **"use client"**: YES
- **Renders**: Nothing (null) - identifies user with PostHog
- **Hooks**: `useEffect`
- **Dependencies**: `posthog-js`
- **Next.js deps**: NONE

### components/exercises/ (10 files)

All exercise components follow the same pattern:
- **"use client"**: YES (all 10)
- **Server Actions**: NONE called directly (SRS updates happen through `flashcard-review.tsx` calling `reviewCard`)
- **API Calls**: Speaking exercise calls `POST /api/stt`; FreeText calls `POST /api/ai-prompt`
- **Next.js deps**: NONE (all are pure client components)

#### `exercise-shell.tsx` - Wrapper providing Check/Continue buttons + Enter key handling
#### `multiple-choice.tsx` - Multiple choice with keyboard shortcuts, audio TTS
#### `translation.tsx` - Type translation with similarity checking
#### `fill-in-the-blank.tsx` - Fill blank in sentence
#### `word-bank.tsx` - Arrange words from bank
#### `matching-pairs.tsx` - Match left/right pairs
#### `listening.tsx` - Listen and type/choose/word-bank (3 sub-modes)
#### `speaking.tsx` - Record speech via MediaRecorder, transcribe via `/api/stt`
#### `free-text.tsx` - Free-form text checked by AI via `/api/ai-prompt`
#### `flashcard-review.tsx` - SRS flashcard with quality rating; calls `reviewCard` server action

**Common dependencies across exercises**: `useExercise` hook, `useAudio` hook, `HoverableText`, `AudioSpinner`, `ReplayButton`, `ExerciseShell`

### components/chat/ (7 files)

#### `chat-view.tsx`
- **"use client"**: YES
- **Renders**: Full chat interface (messages list, input area, model selector, greeting)
- **Hooks/State**: `useChat` from `@ai-sdk/react`, `useRef`, `useEffect`, `useState`, `useCallback`, `useMemo`, `useRouter`, `useIsMobile`, `useMobileKeyboardOpen`
- **Server Actions**: `createConversation`, `saveMessages` from `@/lib/actions/chat`; `recordChatExerciseResult` from `@/lib/actions/srs`; `updatePreferredModel` from `@/lib/actions/preferences`
- **Dependencies**: `DefaultChatTransport` from `ai`, `ChatMessage`, `ThinkingMessage`
- **Next.js deps**: `useRouter` from `next/navigation`
- **CRITICAL**: Uses `@ai-sdk/react` `useChat` hook which connects to `/api/chat` route

#### `chat-layout.tsx`
- **"use client"**: YES
- **Renders**: Chat sidebar with conversation list + main content area
- **Hooks/State**: `usePathname`, `useRouter`, `useState`, `useTransition`, `useMobileKeyboardOpen`
- **Server Actions**: `deleteConversation` from `@/lib/actions/chat`
- **Next.js deps**: `Link` from `next/link`, `usePathname`/`useRouter` from `next/navigation`

#### `chat-message.tsx`
- **"use client"**: YES (memo wrapped)
- **Renders**: Individual chat message with tool call rendering, exercise rendering, unit/article cards
- **Dependencies**: `ChatExercise`, `ChatUnitCard`, `ArticleCard`, `ToolCall`, `HoverableMarkdown`
- **Next.js deps**: NONE

#### `chat-exercise.tsx`
- **"use client"**: YES
- **Renders**: Exercise within chat context, dispatches to specific exercise components
- **Next.js deps**: NONE

#### `unit-card.tsx` (chat)
- **"use client"**: YES
- **Renders**: Unit summary card shown after createUnit tool call
- **Hooks**: `useRouter`
- **Next.js deps**: `useRouter` from `next/navigation`

#### `article-card.tsx` (chat)
- **"use client"**: YES
- **Renders**: Article status card with polling progress
- **Hooks/State**: `useState`, `useEffect`, `useMemo`, `useRouter`
- **API Calls**: `GET /api/articles/{id}/status` (polling)
- **Next.js deps**: `useRouter` from `next/navigation`

#### `tool-call.tsx`
- **"use client"**: YES
- **Renders**: Collapsible tool call display (parameters + result)
- **Hooks/State**: `useState` (isOpen)
- **Next.js deps**: NONE

#### `thinking-message.tsx`
- **"use client"**: YES
- **Renders**: Animated thinking indicator
- **Next.js deps**: NONE

### components/article/ (5 files)

#### `translated-text.tsx`
- **"use client"**: YES
- **Renders**: Article content with view mode toggle (target/bridge/source), word-level click-to-define, audio word highlighting
- **Hooks/State**: `useState` (viewMode, popover), `useEffect`, `useMemo`, `useCallback`, `useRef`, `useIsMobile`
- **Dependencies**: `WordPopover`, `ViewModeToggle`, memo-wrapped sub-components
- **Next.js deps**: NONE

#### `audio-player.tsx`
- **"use client"**: YES
- **Renders**: Fixed audio player with play/pause, seek, speed, reading mode button
- **Hooks/State**: `useState`, `useRef`, `useEffect`
- **Next.js deps**: NONE

#### `reading-mode.tsx`
- **"use client"**: YES
- **Renders**: Full-screen reading mode with word-by-word audio sync, playback controls
- **Hooks/State**: `useState`, `useRef`, `useEffect`, `useCallback`
- **Dependencies**: `ReadingModeText`, audio timestamp alignment
- **Next.js deps**: NONE

#### `reading-mode-text.tsx`
- **"use client"**: YES
- **Renders**: Word-by-word text display with current word highlighting and auto-scroll
- **Hooks/State**: `useRef`, `useEffect`, `useState`, `useCallback`
- **Dependencies**: `WordPopover`
- **Next.js deps**: NONE

#### `view-mode-toggle.tsx`
- **"use client"**: YES
- **Renders**: Toggle between target/bridge/source view modes
- **Next.js deps**: NONE

### components/auth/ (3 files)

#### `sign-up-form.tsx`
- **"use client"**: YES
- **Renders**: Sign-up form (name, email, password, Turnstile, Google OAuth)
- **Hooks/State**: `useState` (fields, error, loading, turnstileToken), `useRef`, `useCallback`, `useRouter`
- **Dependencies**: `signIn`, `signUp` from `@/lib/auth-client`; `Button`, `Input`, `Turnstile`
- **Next.js deps**: `useRouter` from `next/navigation`, `Image` from `next/image`, `Link` from `next/link`
- **Env vars**: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`

#### `sign-in-form.tsx`
- **"use client"**: YES
- **Renders**: Sign-in form (email, password, Turnstile, Google OAuth)
- **Hooks/State**: Same pattern as sign-up
- **Next.js deps**: `useRouter` from `next/navigation`, `Image` from `next/image`, `Link` from `next/link`
- **Env vars**: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`

#### `turnstile.tsx`
- **"use client"**: YES
- **Renders**: Cloudflare Turnstile CAPTCHA widget
- **Hooks**: `useEffect`, `useRef`, `useCallback`, `useImperativeHandle`, `forwardRef`
- **Next.js deps**: `Script` from `next/script`
- **Env vars**: `NEXT_PUBLIC_TURNSTILE_SITE_KEY`

### Other components (2 files)

#### `replay-button.tsx`
- **"use client"**: YES
- **Renders**: Small play audio button
- **Next.js deps**: NONE

#### `audio-spinner.tsx`
- **"use client"**: NO (server-compatible, stateless)
- **Renders**: Loading spinner for audio generation
- **Next.js deps**: NONE

---

## Hooks Catalog

### `hooks/use-audio.ts`
- **"use client"**: YES
- **Purpose**: TTS audio playback with caching. Fetches audio URLs from `/api/tts`, plays via `new Audio()`, supports stop/prefetch.
- **State**: `useRef` (currentAudio, nonce), `useState` (loading)
- **API calls**: `POST /api/tts`
- **Next.js deps**: NONE

### `hooks/use-exercise.ts`
- **"use client"**: YES
- **Purpose**: Simple state machine for exercise status: "answering" -> "correct" | "incorrect"
- **State**: `useState` (status)
- **Next.js deps**: NONE

### `hooks/use-lesson.ts`
- **"use client"**: YES
- **Purpose**: Manages lesson progress through array of exercises; tracks current index, results, mistakes, completion
- **State**: `useState` (currentIndex, results, isComplete, mistakeCount)
- **Next.js deps**: NONE

### `hooks/use-media-query.ts`
- **"use client"**: YES
- **Purpose**: Returns `useIsMobile()` - true when viewport <= 767px
- **Implementation**: Uses `useSyncExternalStore` with `window.matchMedia`
- **Next.js deps**: NONE

### `hooks/use-mobile-keyboard-open.ts`
- **"use client"**: YES
- **Purpose**: Detects mobile virtual keyboard open/close via `visualViewport` API
- **Dependencies**: `useIsMobile` hook
- **Next.js deps**: NONE

---

## App Pages & Layouts Catalog

### Root Layout (`app/layout.tsx`)
- **Type**: Server Component
- **Structure**: `<html><body><PostHogProvider>{children}</PostHogProvider></body></html>`
- **Next.js deps**: `Metadata`/`Viewport` types, `Geist`/`Geist_Mono` from `next/font/google`
- **Data fetching**: NONE
- **Vite impact**: Font loading must be replaced (Google Fonts link or fontsource); metadata system not needed

### Root Page (`app/page.tsx`)
- **Type**: Server Component (async)
- **Renders**: Landing page with CTA buttons, GitHub stars, demo video
- **Data fetching**: `getSession()`, `getGitHubStars()` - direct server calls
- **Next.js deps**: `Link` from `next/link`
- **Vite impact**: Must convert to client component with API fetch for session/stars, or use SSR framework

### Auth Layout (`app/(auth)/layout.tsx`)
- **Type**: Server Component (no async, no data)
- **Renders**: Centered card with logo header
- **Next.js deps**: NONE (pure JSX)
- **Vite impact**: Trivial, just a layout wrapper

### Auth Pages (`sign-in/page.tsx`, `sign-up/page.tsx`, `onboarding/page.tsx`)
- **Type**: Server Components (async)
- **Data fetching**: `searchParams` access (sign-in/sign-up); `getSession()`, `getTargetLanguage()`, `getNativeLanguage()` (onboarding)
- **Next.js deps**: `redirect()` from `next/navigation`
- **Vite impact**: Must convert to client-side routing + API calls for session check

### Main Layout (`app/(main)/layout.tsx`)
- **Type**: Server Component (async)
- **Renders**: Sidebar + TopBar + MobileNav + PostHogIdentify
- **Data fetching**: `getSession()`, `getUserStatsData()`, `getSrsStats()`, `getGitHubStars()` - all server-side
- **Auth guard**: Redirects to `/sign-in` if no session
- **Next.js deps**: `redirect()`, `headers()` from `next/navigation`/`next/headers`
- **Vite impact**: CRITICAL - auth guard + data fetching must become client-side

### Public-or-Auth Layout (`app/(public-or-auth)/layout.tsx`)
- **Type**: Server Component (async)
- **Renders**: Two modes: full app shell (authenticated) or minimal public header (anonymous)
- **Data fetching**: Same as Main Layout when authenticated
- **Next.js deps**: `headers()`, `Link`
- **Vite impact**: Must become a client-side layout with conditional rendering based on auth state

### Chat Layout (`app/(main)/chat/layout.tsx`)
- **Type**: Server Component (async)
- **Data fetching**: `listConversations()` server action
- **Vite impact**: Must fetch conversations client-side

### Chat Pages (`chat/page.tsx`, `chat/[id]/page.tsx`)
- **Type**: Server Components (async)
- **Data fetching**: `requireSession()`, `getTargetLanguage()`, `getPreferredModel()`, `getModelsForUser()`, `getConversation()`
- **Next.js deps**: `notFound()`, `searchParams`
- **Vite impact**: Convert to client-side data fetching with loading states

### Units Page (`units/page.tsx`)
- **Type**: Server Component (async)
- **Data fetching**: `auth.api.getSession()`, `getStandaloneUnits()`, `getUserOwnedCourses()`, `isAdminEmail()`
- **Next.js deps**: `Link`, `headers()`
- **Co-located client components**: `StandaloneUnits`, `MyCourses`, `CreateCourseForm`, `CourseBrowser`, `BrowseUnits`, `CourseManager`, `LearningPath`, `CourseCard`, `UnitEditor`

### Units Course Detail (`units/[courseId]/page.tsx`)
- **Type**: Server Component (async)
- **Data fetching**: `getCourseWithContent()`, `getUserProgress()`
- **Next.js deps**: `notFound()`, `headers()`

### Units Edit (`units/edit/[unitId]/page.tsx`)
- **Type**: Server Component (async)
- **Data fetching**: `getUnitForEdit()`, `isAdminEmail()`
- **Next.js deps**: `redirect()`, `headers()`

### Units Browse (`units/browse/page.tsx`)
- **Type**: Server Component (async)
- **Data fetching**: `getNativeLanguage()`, `getTargetLanguage()`, `listCoursesWithLessonCounts()`, `getAvailableFilters()`, `getBrowsableUnits()`

### Words Page (`words/page.tsx`)
- **Type**: Server Component (async)
- **Data fetching**: `getTargetLanguage()`, `loadLanguageRaw()`, `getAllCards()`, `getSrsStats()`
- **Next.js deps**: `redirect()`

### Read Page (`read/page.tsx`)
- **Type**: Server Component (async)
- **Data fetching**: Direct Drizzle DB query for articles
- **Next.js deps**: `Link`

### Read Article Detail (`read/[id]/page.tsx`)
- **Type**: CLIENT Component ("use client") - UNIQUE among pages
- **Renders**: Full article reader with translated text, audio player, reading mode
- **Hooks/State**: Extensive - useState, useEffect, useMemo, useCallback, useRouter
- **API Calls**: `GET /api/articles/{id}`, `GET /api/articles/{id}/audio`, `GET /api/articles/{id}/timestamps`, `POST /api/articles/{id}/audio`, `DELETE /api/articles/{id}`
- **Next.js deps**: `useRouter` from `next/navigation`

### Settings Page (`settings/page.tsx`)
- **Type**: Server Component (async)
- **Data fetching**: `requireSession()`, `getPrompts()`, `getMemory()`, `getTargetLanguage()`, `getNativeLanguage()`
- **Co-located client components**: `SettingsView`, `PromptEditor`, `MemoryEditor`

### Lesson Page (`lesson/[courseId]/[unitId]/[lessonIndex]/page.tsx`)
- **Type**: Server Component (async)
- **Data fetching**: `getCourseWithContent()`
- **Next.js deps**: `notFound()`, `headers()`
- **Co-located client**: `LessonView`

### Standalone Unit Page (`(public-or-auth)/unit/[unitId]/page.tsx`)
- **Type**: Server Component (async)
- **Data fetching**: `getSession()`, `getUnitWithContent()`, `getUnitProgress()`
- **Features**: `generateMetadata()` for OG tags
- **Next.js deps**: `notFound()`, `redirect()`, `Link`, `Metadata` type
- **Co-located client**: `StandaloneUnitPath`, `PublicUnitPath`

### Standalone Lesson Page (`(public-or-auth)/unit/[unitId]/lesson/[lessonIndex]/page.tsx`)
- **Type**: Server Component (async)
- **Data fetching**: `getSession()`, `getUnitWithContent()`
- **Next.js deps**: `redirect()`, `notFound()`
- **Reuses**: `LessonView` from main lesson route

---

## Providers

### PostHogProvider (`components/providers/posthog.tsx`)
- Wraps entire app at root layout level
- Initializes PostHog client-side with `NEXT_PUBLIC_POSTHOG_KEY`
- Auto-captures pageviews on route changes using `usePathname` + `useSearchParams`
- **Vite impact**: Must replace `usePathname`/`useSearchParams` with Vite router equivalents

### PostHogIdentify (`components/providers/posthog-identify.tsx`)
- Rendered in main/public-or-auth layouts
- Identifies user to PostHog on mount
- **Vite impact**: Minimal, just needs user data passed as props

---

## Styling Approach

### `app/globals.css`
- Uses **Tailwind CSS v4** with `@import "tailwindcss"` syntax
- **CSS custom properties** for the design system:
  - Colors: `--lingo-green`, `--lingo-blue`, `--lingo-purple`, `--lingo-red`, `--lingo-orange`, `--lingo-yellow`, `--lingo-gray`, etc.
  - Semantic tokens: `--lingo-bg`, `--lingo-card`, `--lingo-border`, `--lingo-text`, `--lingo-text-light`
- **`@theme inline`** block maps CSS vars to Tailwind color tokens (`--color-lingo-*`)
- **Custom keyframe animations**: `pulse-glow`, `bounce-in`, `slide-up`, `xp-count`
- **Custom utility classes**: `.animate-pulse-glow`, `.animate-bounce-in`, `.animate-slide-up`, `.animate-xp-count`
- **Font**: Geist Sans + Geist Mono via `next/font/google`, referenced as `--font-geist-sans` / `--font-geist-mono`

**Vite impact**: 
- Tailwind CSS v4 works with Vite natively (PostCSS plugin)
- Font loading must switch from `next/font` to `@fontsource/geist` or a `<link>` tag
- The `@theme inline` block is Tailwind v4 specific and will work as-is
- All CSS custom properties will work unchanged

---

## Server Actions Dependency Map

These are ALL files in `lib/actions/` with `"use server"`. Each must become an API endpoint in a Vite app.

| Server Action File | Functions | Called From (Client Components) |
|---|---|---|
| `lib/actions/srs.ts` | `addOrFailWord`, `reviewCard`, `recordChatExerciseResult`, `getAllCards`, `getSrsStats`, `bulkAddWordsToSrs`, `addWordToSrs`, `removeWordFromSrs`, `removeAllWordsFromSrs` | `word-tooltip.tsx`, `flashcard-review.tsx`, `chat-view.tsx`, `word-explorer.tsx` |
| `lib/actions/chat.ts` | `createConversation`, `saveMessages`, `deleteConversation`, `listConversations`, `getConversation` | `chat-view.tsx`, `chat-layout.tsx` |
| `lib/actions/preferences.ts` | `updateTargetLanguage`, `getTargetLanguage`, `updatePreferredModel`, `getPreferredModel` | `onboarding-form.tsx`, `settings-view.tsx`, `chat-view.tsx` |
| `lib/actions/profile.ts` | `updateNativeLanguage`, `getNativeLanguage` | `onboarding-form.tsx`, `settings-view.tsx` |
| `lib/actions/prompts.ts` | `getPrompts`, `getMemory`, `savePrompt`, `resetPrompt`, `saveMemory` | `prompt-editor.tsx`, `memory-editor.tsx` |
| `lib/actions/progress.ts` | `getUserStatsData`, `getUserProgress`, `getUnitProgress` | Server components only (layouts, pages) |
| `lib/actions/lesson.ts` | `completeLesson` | `lesson-view.tsx` |
| `lib/actions/units.ts` | `makeUnitPublic`, `makeUnitPrivate`, `deleteUnit`, `updateUnitMarkdown`, `createCourse`, `makeCoursePublic`, `makeCoursePrivate`, `deleteCourse`, `fetchCourseManagementData`, `addUnitToCourse`, `removeUnitFromCourse` | `standalone-units.tsx`, `my-courses.tsx`, `unit-editor.tsx`, `create-course-form.tsx`, `course-manager.tsx` |
| `lib/actions/library.ts` | `addUnitToLibrary`, `removeUnitFromLibrary` | `browse-units.tsx`, `standalone-units.tsx` |

**Total server actions to convert to API routes: ~35+ functions across 9 files**

---

## API Routes Dependency Map

Existing API routes that client components call via `fetch()`:

| Route | Method | Called From |
|---|---|---|
| `/api/word/lookup` | GET | `word-tooltip.tsx` |
| `/api/tts` | POST | `use-audio.ts` hook |
| `/api/stt` | POST | `speaking.tsx` |
| `/api/ai-prompt` | POST | `free-text.tsx` |
| `/api/chat` | POST (streaming) | `chat-view.tsx` via AI SDK |
| `/api/articles/{id}` | GET, DELETE | `read/[id]/page.tsx` |
| `/api/articles/{id}/status` | GET | `article-card.tsx` |
| `/api/articles/{id}/audio` | GET, POST | `read/[id]/page.tsx` |
| `/api/articles/{id}/timestamps` | GET | `read/[id]/page.tsx` |
| `/api/auth/[...all]` | ALL | `better-auth` client SDK |

**These routes must be reimplemented as Express/Fastify/Hono endpoints in a Vite backend.**

---

## Next.js-Specific Feature Usage

### `next/link` (Link component)
Used in 18+ files. Replace with `react-router-dom` `<Link>` or equivalent.

**Files**: `lesson-node.tsx`, `sidebar.tsx`, `mobile-nav.tsx`, `chat-layout.tsx`, `sign-up-form.tsx`, `sign-in-form.tsx`, `public-unit-path.tsx`, `standalone-units.tsx`, `my-courses.tsx`, `browse-units.tsx`, `unit-editor.tsx`, `course-card.tsx`, `app/page.tsx`, `app/(main)/units/page.tsx`, `app/(main)/read/page.tsx`, `app/(main)/units/browse/page.tsx`, `app/(public-or-auth)/layout.tsx`, `app/(public-or-auth)/unit/[unitId]/page.tsx`

### `next/navigation` (useRouter, usePathname, useSearchParams, redirect, notFound)
Used in 25+ files.

**`useRouter().push()`**: `onboarding-form.tsx`, `top-bar.tsx`, `chat-layout.tsx`, `chat-view.tsx`, `unit-card.tsx` (chat), `article-card.tsx`, `lesson-view.tsx`, `word-explorer.tsx`, `standalone-units.tsx`, `my-courses.tsx`, `create-course-form.tsx`, `course-manager.tsx`, `unit-editor.tsx`, `browse-units.tsx`, `read/[id]/page.tsx`

**`useRouter().replace()`**: `chat-view.tsx` (replacing URL after creating conversation)

**`useRouter().refresh()`**: `chat-layout.tsx`, `word-explorer.tsx`, `standalone-units.tsx`, `my-courses.tsx`, `course-manager.tsx`, `browse-units.tsx`

**`usePathname()`**: `sidebar.tsx`, `mobile-nav.tsx`, `chat-layout.tsx`, `posthog.tsx`

**`useSearchParams()`**: `posthog.tsx`, `learning-path.tsx`

**`redirect()`**: Server components only - `(main)/layout.tsx`, `onboarding/page.tsx`, `units/edit/page.tsx`, `words/page.tsx`, `(public-or-auth)/unit/page.tsx`, `(public-or-auth)/lesson/page.tsx`

**`notFound()`**: `chat/[id]/page.tsx`, `units/[courseId]/page.tsx`, `(public-or-auth)/unit/page.tsx`, `lesson/page.tsx`

### `next/image` (Image component)
Used in 2 files: `sign-up-form.tsx`, `sign-in-form.tsx` (for Google logo SVG).
Replace with standard `<img>` tag.

### `next/script` (Script component)
Used in 1 file: `turnstile.tsx` (Cloudflare Turnstile script loading).
Replace with manual `<script>` tag insertion or a React helmet-like solution.

### `next/font/google` (Font loading)
Used in 1 file: `app/layout.tsx` (Geist Sans + Geist Mono).
Replace with `@fontsource/geist` npm package or `<link>` to Google Fonts CDN.

### Server Components (async function components with direct server access)
20+ page/layout files use async server components for:
- Session checking (`getSession()`, `requireSession()`)
- Database queries (via Drizzle through server actions or direct queries)
- Auth guards (redirect if not authenticated)
- Data prefetching for client components

### `react` cache()
Used in `lib/auth-server.ts` to deduplicate `getSession()` calls within a single request.

### `next/headers` headers()
Used in `lib/auth-server.ts` and multiple server pages for auth.

---

## Design Decisions & Edge Cases

### 1. Authentication Architecture
The app uses `better-auth` with both client (`lib/auth-client.ts`) and server (`lib/auth-server.ts`) SDKs. The client SDK (`signIn`, `signUp`, `signOut`, `useSession`) works independently of Next.js. The server SDK uses `headers()` from `next/headers`. In a Vite app, the auth client SDK should work unchanged, but the server auth must be reimplemented as middleware.

### 2. AI Chat Streaming
`chat-view.tsx` uses `@ai-sdk/react`'s `useChat` hook with `DefaultChatTransport`. This connects to `/api/chat` which is a Next.js route handler that streams AI responses. The `@ai-sdk/react` client-side code is framework-agnostic and will work in Vite. The `/api/chat` route must be reimplemented as a streaming endpoint.

### 3. The "use client" / Server Component Boundary
The app follows a clean pattern where:
- **Pages** are server components that fetch data, then pass it as props to client components
- **Client components** handle all interactivity
- This pattern must change to: client components fetch their own data, OR a data-fetching layer (React Query, SWR) is introduced

### 4. Server Actions Called Directly from Client Components
~35 server action functions are called directly from event handlers in client components (e.g., `await updateTargetLanguage(target)` inside `onSubmit`). Each must become a `fetch()` call to an API endpoint.

### 5. `router.refresh()` Usage
Many components call `router.refresh()` after server action mutations to re-fetch server component data. In a Vite app, this must be replaced with state invalidation (e.g., React Query `invalidateQueries()`).

### 6. Route Groups
The app uses Next.js route groups: `(main)`, `(auth)`, `(public-or-auth)`. These provide different layouts based on auth state. In Vite, these become nested route layouts in the router configuration.

### 7. OG Image Generation
`app/(public-or-auth)/unit/[unitId]/og-image/route.tsx` generates OG images server-side. This would need a separate server endpoint.

### 8. `generateMetadata()` for SEO
The standalone unit page uses `generateMetadata()` for dynamic OG tags. In a Vite SPA, this would need either SSR or a prerendering solution.

### 9. Environment Variables
Several `NEXT_PUBLIC_*` env vars are used client-side:
- `NEXT_PUBLIC_POSTHOG_KEY`
- `NEXT_PUBLIC_POSTHOG_HOST`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
These must be renamed to `VITE_*` prefix.

### 10. Loading States
Several pages have `loading.tsx` files for Next.js Suspense boundaries. These skeleton states should be preserved in the Vite app using React Suspense or loading state management.

---

## Migration Todo List

### Phase 1: Project Setup
- [ ] Initialize Vite + React + TypeScript project
- [ ] Configure Tailwind CSS v4 with PostCSS
- [ ] Set up path aliases (`@/` -> `src/`)
- [ ] Install and configure `react-router-dom` v6+
- [ ] Install fonts (Geist Sans/Mono) via @fontsource or CDN link
- [ ] Copy `globals.css` (works as-is with Tailwind v4)
- [ ] Set up environment variables (rename `NEXT_PUBLIC_` to `VITE_`)

### Phase 2: Backend API Layer
- [ ] Choose backend framework (Express / Fastify / Hono)
- [ ] Create API routes for all 11 existing Next.js API routes
- [ ] Create API routes for all ~35 server actions (or group logically)
- [ ] Implement auth middleware using `better-auth` server SDK
- [ ] Implement streaming endpoint for AI chat
- [ ] Set up database connection (Drizzle ORM - no changes needed)

### Phase 3: Copy Pure Client Components (No Changes Needed)
- [ ] All `components/ui/` (6 files) - remove "use client" directive
- [ ] All `components/exercises/` (10 files) - remove "use client" directive
- [ ] All `components/word/` (4 files) - remove "use client" directive  
- [ ] All `components/article/` (5 files) - remove "use client" directive
- [ ] `components/gamification/` (2 files)
- [ ] `components/replay-button.tsx`, `components/audio-spinner.tsx`
- [ ] All `hooks/` (5 files) - remove "use client" directive

### Phase 4: Migrate Next.js-Dependent Components
- [ ] Replace `next/link` -> `react-router-dom` Link in ~18 files
- [ ] Replace `next/navigation` useRouter -> `react-router-dom` useNavigate in ~15 files
- [ ] Replace `usePathname` -> `react-router-dom` useLocation in ~4 files
- [ ] Replace `useSearchParams` -> `react-router-dom` useSearchParams in ~2 files
- [ ] Replace `next/image` -> `<img>` in 2 files (sign-in/sign-up forms)
- [ ] Replace `next/script` -> manual script loading in turnstile.tsx
- [ ] Update PostHog provider to use router events instead of Next.js hooks

### Phase 5: Convert Server Components to Client + API
- [ ] Create data-fetching hooks (React Query recommended) for:
  - Session / auth state
  - User stats (streak, words)
  - GitHub stars
  - Conversations list
  - Target/native language preferences
  - SRS cards and stats
  - Course/unit data
  - Article data
- [ ] Convert each page to client component + data fetching hook
- [ ] Implement auth guards as route-level guards (react-router loaders or wrapper components)

### Phase 6: Replace Server Actions with API Calls
- [ ] Create API client module with typed fetch wrappers
- [ ] Replace all direct server action calls in client components with fetch calls
- [ ] Replace `router.refresh()` with React Query cache invalidation

### Phase 7: Routing Configuration
- [ ] Define all routes in react-router configuration
- [ ] Implement layout nesting (main layout, auth layout, public-or-auth layout)
- [ ] Implement loading states (Suspense boundaries or component-level)
- [ ] Handle 404 pages
- [ ] Handle redirects (auth guard, onboarding flow)

### Phase 8: Features That Need Special Attention
- [ ] AI chat streaming (ensure `@ai-sdk/react` works with new backend URL)
- [ ] Cloudflare Turnstile (script loading without `next/script`)
- [ ] PostHog pageview tracking (hook into router)
- [ ] OG image generation (server endpoint or static generation)
- [ ] SEO metadata (consider prerendering or SSR for public pages)
- [ ] `better-auth` client SDK (should work unchanged, verify cookie handling)
- [ ] PWA manifest (`/manifest.json` - copy to public/)
