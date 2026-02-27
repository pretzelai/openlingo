# Rewriting OpenLingo as a Vite Frontend-Only App with Backend API

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current Architecture Analysis](#2-current-architecture-analysis)
3. [Target Architecture](#3-target-architecture)
4. [What Can Move to the Frontend (Bundled + Cached)](#4-what-can-move-to-the-frontend-bundled--cached)
5. [What Must Stay as Backend API](#5-what-must-stay-as-backend-api)
6. [Frontend Rewrite: Vite Project Setup](#6-frontend-rewrite-vite-project-setup)
7. [Routing & Navigation](#7-routing--navigation)
8. [Authentication Strategy](#8-authentication-strategy)
9. [Data Fetching & State Management](#9-data-fetching--state-management)
10. [Component Migration Guide](#10-component-migration-guide)
11. [Caching Strategy (Service Worker / PWA)](#11-caching-strategy-service-worker--pwa)
12. [Backend API Design](#12-backend-api-design)
13. [Dictionary & Content Strategy](#13-dictionary--content-strategy)
14. [AI Chat Streaming Migration](#14-ai-chat-streaming-migration)
15. [Key Design Decisions](#15-key-design-decisions)
16. [Risk Assessment & Edge Cases](#16-risk-assessment--edge-cases)
17. [Implementation Todo List](#17-implementation-todo-list)

---

## 1. Executive Summary

OpenLingo is currently a **Next.js 16 App Router** application with deep server-side coupling: 20+ server components that fetch data via direct DB access, 47 server actions called from client components, 15 API route endpoints, and 9 AI tools that execute server-side during chat.

**The rewrite goal**: A Vite-built SPA that is fully cacheable in the browser (via Service Worker), loads instantly on repeat visits, and communicates with a separate backend API for data persistence and AI operations.

### Key Numbers

| Metric | Count |
|--------|-------|
| Components to migrate | 49 (35 already "use client") |
| Custom hooks | 5 (0 Next.js deps, copy as-is) |
| Server components to convert | 20 pages + 5 layouts |
| Server actions to become API calls | 47 functions across 9 files |
| Existing API routes to keep | 15 endpoints across 11 files |
| Next.js-specific imports to replace | ~60 occurrences across ~30 files |
| Pure client code (zero changes needed) | ~30 component files + 5 hooks |
| Pure utility modules (copy as-is) | 10 files (~35 KB) |
| Static content (bundleable) | 18 KB markdown + 46 KB assets |
| Dictionary data (lazy-load) | 94 MB across 14 languages |

### Feasibility Verdict

**Highly feasible.** The codebase is already well-separated:
- 35 of 49 components are already `"use client"` and most have zero Next.js dependencies
- The content parsing pipeline, SRS algorithm, and utility modules are pure TypeScript
- The `@ai-sdk/react` chat hook is framework-agnostic
- The `better-auth` client SDK is framework-agnostic
- Tailwind CSS v4 works natively with Vite

The main work is: (1) converting 20 server-component pages into client components with API fetching, (2) replacing ~47 server action calls with fetch calls, and (3) replacing ~60 `next/*` import occurrences.

---

## 2. Current Architecture Analysis

### Tech Stack

| Layer | Current | Vite Replacement |
|-------|---------|-----------------|
| Framework | Next.js 16 (App Router) | Vite 6 + React 19 |
| Routing | File-system routing (app/) | React Router v7 (or TanStack Router) |
| Server rendering | React Server Components | None (SPA) -- all client-rendered |
| Data fetching | Server components + server actions | React Query (TanStack Query) + fetch |
| Styling | Tailwind CSS v4 (PostCSS) | Tailwind CSS v4 (PostCSS) -- no change |
| Auth | better-auth (server + client SDK) | better-auth client SDK (unchanged) + backend API |
| AI Chat | AI SDK `useChat` + Next.js route | AI SDK `useChat` + backend streaming endpoint |
| Build | `next build` | `vite build` |
| Deployment | Vercel (SSR) | Any static host (Cloudflare Pages, Vercel Static, S3+CloudFront) |

### Current Data Flow

```
Browser                          Next.js Server                    External Services
  |                                    |                                   |
  |--- Server Component Request ------>|                                   |
  |                                    |--- DB Query (Drizzle) ----------->| PostgreSQL
  |                                    |--- getSession() (headers) ------->| (cookies)
  |<-- HTML with embedded data --------|                                   |
  |                                    |                                   |
  |--- Server Action Call ------------>|                                   |
  |                                    |--- requireSession() ------------->|
  |                                    |--- DB mutation ------------------>| PostgreSQL
  |<-- Action result ------------------|                                   |
  |                                    |                                   |
  |--- POST /api/chat --------------->|                                   |
  |                                    |--- AI SDK streamText() ---------->| OpenAI/Anthropic/Google
  |<-- SSE stream --------------------|                                   |
```

### Target Data Flow

```
Browser (Vite SPA)              Backend API (Hono/Express)        External Services
  |                                    |                                   |
  |--- GET /api/courses -------------->|                                   |
  |                                    |--- DB Query (Drizzle) ----------->| PostgreSQL
  |                                    |--- validateSession(cookie) ------>|
  |<-- JSON response ------------------|                                   |
  |                                    |                                   |
  |--- POST /api/srs/review --------->|                                   |
  |                                    |--- requireSession() ------------->|
  |                                    |--- DB mutation ------------------>| PostgreSQL
  |<-- JSON response ------------------|                                   |
  |                                    |                                   |
  |--- POST /api/chat --------------->|                                   |
  |                                    |--- AI SDK streamText() ---------->| OpenAI/Anthropic/Google
  |<-- SSE stream --------------------|                                   |
```

---

## 3. Target Architecture

### Frontend (Vite SPA)

```
vite-app/
  src/
    main.tsx                    # Entry point, router setup
    App.tsx                     # Root component with providers
    router.tsx                  # Route definitions
    api/                        # API client layer (typed fetch wrappers)
      client.ts                 # Base fetch with auth cookies
      auth.ts                   # Auth API calls
      chat.ts                   # Chat API calls
      srs.ts                    # SRS API calls
      courses.ts                # Course/unit API calls
      ...
    components/                 # All React components (copied from current)
    hooks/                      # All custom hooks (copied as-is)
    lib/                        # Pure utility modules
      content/                  # Content parsers (copied as-is)
      srs.ts                    # SM-2 algorithm (copied as-is)
      languages.ts              # Language config (copied as-is)
      constants.ts              # App constants
      colors.ts                 # Color utilities
      auth-client.ts            # better-auth client (copied as-is)
    content/                    # Seed markdown files (imported as ?raw)
    pages/                      # Page-level components (converted from server components)
    layouts/                    # Layout components (converted from server components)
    providers/                  # Context providers (PostHog, auth, query client)
  public/
    manifest.json               # PWA manifest
    sw.js                       # Service worker for caching
    icons/                      # App icons
    words/                      # Dictionary JSONs (lazy-loaded)
  index.html                    # SPA entry
  vite.config.ts                # Vite configuration
  tailwind.config.ts            # (or inline via postcss.config)
```

### Backend API (Separate Service)

```
api/
  src/
    index.ts                    # Entry point (Hono/Express/Fastify)
    middleware/
      auth.ts                   # Session validation middleware
      cors.ts                   # CORS configuration
    routes/
      auth.ts                   # better-auth handler
      chat.ts                   # AI chat streaming
      srs.ts                    # SRS CRUD (14 endpoints)
      courses.ts                # Course/unit CRUD (11+ endpoints)
      lessons.ts                # Lesson completion
      preferences.ts            # User preferences
      profile.ts                # User profile
      prompts.ts                # Prompt management
      articles.ts               # Article CRUD + translation
      media.ts                  # TTS, STT, audio
      words.ts                  # Dictionary word lookup
    lib/
      db/                       # Drizzle ORM (reused as-is)
      ai/                       # AI tools & models (reused as-is)
      article/                  # Article processing pipeline (reused as-is)
      auth.ts                   # better-auth server config (reused)
```

---

## 4. What Can Move to the Frontend (Bundled + Cached)

These modules are **pure TypeScript** with zero server dependencies and can be imported directly into the Vite bundle:

### Content Parsing (100% client-compatible)

| File | Size | Purpose |
|------|------|---------|
| `lib/content/types.ts` | ~6 KB | TypeScript types for all content structures |
| `lib/content/exercise-schema.ts` | ~4 KB | Zod validation schemas for 9 exercise types |
| `lib/content/parser.ts` | ~9 KB | Core exercise markdown parser |
| `lib/content/course-parser.ts` | ~1 KB | Course frontmatter parser |
| `lib/content/unit-parser.ts` | ~2.5 KB | Unit markdown parser with lesson splitting |
| `lib/content/exercise-syntax.ts` | ~7 KB | Exercise syntax documentation constant |
| `lib/content/loader.ts` | ~1 KB | `getUnitLessons()` and `getUnitLessonsSafe()` only (exclude `loadContentDir()`) |

### Utility Modules (100% client-compatible)

| File | Size | Purpose |
|------|------|---------|
| `lib/srs.ts` | ~2 KB | SM-2 spaced repetition algorithm (pure math) |
| `lib/srs-words.ts` | ~0.5 KB | Exercise-to-SRS-word extractor |
| `lib/languages.ts` | ~2 KB | Language names/flags/supported list |
| `lib/constants.ts` | ~0.1 KB | App constants |
| `lib/colors.ts` | ~0.4 KB | Unit color palette |
| `lib/similarity.ts` | ~2 KB | String similarity for answer checking |

### Static Content (bundleable)

| Asset | Size | Strategy |
|-------|------|----------|
| `content/*.md` (11 files) | 18 KB | Import via Vite `?raw`, parse at runtime |
| `public/*` (icons, manifest) | 46 KB | Copy to Vite `public/` |
| `app/globals.css` | ~5 KB | Copy as-is (Tailwind v4 compatible) |

### Components with Zero Next.js Dependencies (copy + remove "use client")

These 30+ components can be copied as-is, just removing the `"use client"` directive (not needed in Vite):

- **All exercises** (10 files): `exercise-shell.tsx`, `multiple-choice.tsx`, `translation.tsx`, `fill-in-the-blank.tsx`, `word-bank.tsx`, `matching-pairs.tsx`, `listening.tsx`, `speaking.tsx`, `free-text.tsx`, `flashcard-review.tsx`
- **All word components** (4 files): `word-tooltip.tsx`, `word-popover.tsx`, `hoverable-text.tsx`, `hoverable-markdown.tsx`
- **All article components** (5 files): `translated-text.tsx`, `audio-player.tsx`, `reading-mode.tsx`, `reading-mode-text.tsx`, `view-mode-toggle.tsx`
- **All UI components** (6 files): `button.tsx`, `input.tsx`, `card.tsx`, `badge.tsx`, `progress-bar.tsx`, `copy-link-button.tsx`
- **Gamification** (2 files): `streak-flame.tsx`, `lesson-complete-modal.tsx`
- **Chat** (5 files): `chat-message.tsx`, `chat-exercise.tsx`, `tool-call.tsx`, `thinking-message.tsx`
- **Other**: `replay-button.tsx`, `audio-spinner.tsx`, `path-connector.tsx`
- **All hooks** (5 files): `use-audio.ts`, `use-exercise.ts`, `use-lesson.ts`, `use-media-query.ts`, `use-mobile-keyboard-open.ts`

### Components Needing Minor Changes (Next.js imports only)

These need `next/link` -> `react-router-dom` Link, or `next/navigation` -> `react-router-dom` hooks:

| Component | Changes Needed |
|-----------|---------------|
| `lesson-node.tsx` | `Link` from `next/link` -> react-router |
| `sidebar.tsx` | `Link`, `usePathname` -> react-router |
| `top-bar.tsx` | `useRouter` -> `useNavigate` |
| `mobile-nav.tsx` | `Link`, `usePathname` -> react-router |
| `chat-view.tsx` | `useRouter` -> `useNavigate`; server actions -> API calls |
| `chat-layout.tsx` | `Link`, `usePathname`, `useRouter` -> react-router; server action -> API |
| `unit-card.tsx` (chat) | `useRouter` -> `useNavigate` |
| `article-card.tsx` | `useRouter` -> `useNavigate` |
| `onboarding-form.tsx` | `useRouter` -> `useNavigate`; server actions -> API |
| `sign-in-form.tsx` | `useRouter`, `Image`, `Link` -> react-router + `<img>` |
| `sign-up-form.tsx` | `useRouter`, `Image`, `Link` -> react-router + `<img>` |
| `turnstile.tsx` | `Script` from `next/script` -> manual `<script>` |
| `posthog.tsx` | `usePathname`, `useSearchParams` -> react-router |

---

## 5. What Must Stay as Backend API

### Operations That Require Server-Side Execution

**1. Authentication (AUTH)**
- Session management (cookie-based, server-validated)
- User creation with DB hooks (auto-init stats, preferences)
- Google OAuth flow (requires client secret)
- Turnstile verification (requires server-side secret)

**2. All Database Operations (DATA) -- 47 server actions + 11 query helpers**
- User CRUD (stats, preferences, memory, profile)
- SRS card management (14 operations: add, remove, review, introduce, stats, etc.)
- Chat conversation persistence (5 operations)
- Course/unit CRUD (11 operations)
- Lesson completion recording (1 complex operation with 7 DB writes)
- Article management (CRUD + status polling)
- User library management (2 operations)
- Progress tracking (3 operations)
- Prompt management (6 operations)

**3. AI Operations (AI)**
- Chat streaming with tools (POST /api/chat) -- requires API keys + tool execution
- Word lookup with AI fallback (GET /api/word/lookup) -- requires API keys
- AI prompt execution (POST /api/ai-prompt) -- requires API keys
- Article translation pipeline (background job) -- requires API keys + DB writes
- 9 AI tools executed during chat (all require DB access)

**4. Media Operations (MEDIA)**
- Text-to-Speech generation (POST /api/tts) -- requires OpenAI API key
- Speech-to-Text transcription (POST /api/stt) -- requires OpenAI API key
- Audio file storage/retrieval via Cloudflare R2
- Article audio generation (background job)

### Summary: 62+ Backend Endpoints Needed

| Category | Endpoints | Source |
|----------|-----------|--------|
| Auth | ~8 (better-auth handles this) | Existing catch-all route |
| SRS | 14 | `lib/actions/srs.ts` |
| Chat | 5 (conversations) + 1 (streaming) | `lib/actions/chat.ts` + `api/chat` |
| Courses/Units | 11 | `lib/actions/units.ts` |
| Preferences | 4 | `lib/actions/preferences.ts` |
| Profile | 3 | `lib/actions/profile.ts` |
| Progress | 3 | `lib/actions/progress.ts` |
| Prompts/Memory | 6 | `lib/actions/prompts.ts` |
| Lessons | 1 | `lib/actions/lesson.ts` |
| Library | 2 | `lib/actions/library.ts` |
| Articles | 7 | Existing API routes |
| Media | 3 (TTS, STT, audio proxy) | Existing API routes |
| Words | 1 | Existing API route |
| AI Prompt | 1 | Existing API route |
| Course queries | 11 | `lib/db/queries/courses.ts` (used by pages) |

---

## 6. Frontend Rewrite: Vite Project Setup

### Vite Configuration

```typescript
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import tailwindcss from '@tailwindcss/vite'  // Tailwind v4 native Vite plugin

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icon.svg'],
      manifest: {
        name: 'OpenLingo',
        short_name: 'OpenLingo',
        description: 'OpenSource AI connected to language learning',
        theme_color: '#58CC02',
        background_color: '#ffffff',
        display: 'standalone',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\.openlingo\.dev\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
            },
          },
          {
            urlPattern: /\/words\/.*\.json$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'dictionary-cache',
              expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 30 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: { '@': '/src' },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'react-vendor': ['react', 'react-dom'],
          'ai-sdk': ['@ai-sdk/react', 'ai'],
          'markdown': ['react-markdown', 'gray-matter'],
        },
      },
    },
  },
})
```

### Key Dependencies

```json
{
  "dependencies": {
    "react": "^19.2.0",
    "react-dom": "^19.2.0",
    "react-router-dom": "^7.0.0",
    "@tanstack/react-query": "^5.0.0",
    "@ai-sdk/react": "^1.0.0",
    "ai": "^4.0.0",
    "better-auth": "^1.4.0",
    "posthog-js": "^1.0.0",
    "react-markdown": "^9.0.0",
    "gray-matter": "^4.0.0",
    "remark-breaks": "^4.0.0",
    "zod": "^3.0.0",
    "@tailwindcss/vite": "^4.0.0",
    "tailwindcss": "^4.0.0"
  },
  "devDependencies": {
    "vite": "^6.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "vite-plugin-pwa": "^0.20.0",
    "typescript": "^5.0.0"
  }
}
```

### Font Loading (replacing `next/font/google`)

```html
<!-- index.html -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono&display=swap" rel="stylesheet">
```

Or install `@fontsource-variable/geist` and `@fontsource/geist-mono` and import in `main.tsx`.

### Environment Variables

| Current (Next.js) | New (Vite) | Purpose |
|---|---|---|
| `NEXT_PUBLIC_POSTHOG_KEY` | `VITE_POSTHOG_KEY` | PostHog project key |
| `NEXT_PUBLIC_POSTHOG_HOST` | `VITE_POSTHOG_HOST` | PostHog API host |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | `VITE_TURNSTILE_SITE_KEY` | Cloudflare Turnstile site key |
| (new) | `VITE_API_URL` | Backend API base URL |

---

## 7. Routing & Navigation

### Route Map

Current Next.js file-system routes -> React Router configuration:

```typescript
// src/router.tsx
import { createBrowserRouter } from 'react-router-dom'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,          // PostHog provider, fonts
    children: [
      { index: true, element: <LandingPage /> },

      // Auth routes (centered card layout)
      {
        element: <AuthLayout />,
        children: [
          { path: 'sign-in', element: <SignInPage /> },
          { path: 'sign-up', element: <SignUpPage /> },
          { path: 'onboarding', element: <OnboardingPage /> },
        ],
      },

      // Authenticated routes (sidebar + topbar layout)
      {
        element: <AuthGuard><MainLayout /></AuthGuard>,
        children: [
          { path: 'chat', element: <ChatLayout />, children: [
            { index: true, element: <NewChatPage /> },
            { path: ':id', element: <ChatPage /> },
          ]},
          { path: 'units', element: <UnitsPage /> },
          { path: 'units/browse', element: <BrowseUnitsPage /> },
          { path: 'units/edit/:unitId', element: <EditUnitPage /> },
          { path: 'units/:courseId', element: <CourseDetailPage /> },
          { path: 'words', element: <WordsPage /> },
          { path: 'read', element: <ReadListPage /> },
          { path: 'read/:id', element: <ReadArticlePage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'lesson/:courseId/:unitId/:lessonIndex', element: <LessonPage /> },
        ],
      },

      // Public-or-auth routes (conditional layout)
      {
        element: <PublicOrAuthLayout />,
        children: [
          { path: 'unit/:unitId', element: <StandaloneUnitPage /> },
          { path: 'unit/:unitId/lesson/:lessonIndex', element: <StandaloneLessonPage /> },
        ],
      },
    ],
  },
])
```

### Next.js Import Replacements

| Next.js | React Router Replacement | Files Affected |
|---------|------------------------|----------------|
| `import Link from 'next/link'` | `import { Link } from 'react-router-dom'` | 18 files |
| `import { useRouter } from 'next/navigation'` | `import { useNavigate } from 'react-router-dom'` | 15 files |
| `router.push(path)` | `navigate(path)` | 15 files |
| `router.replace(path)` | `navigate(path, { replace: true })` | 1 file |
| `router.refresh()` | `queryClient.invalidateQueries()` | 6 files |
| `import { usePathname } from 'next/navigation'` | `import { useLocation } from 'react-router-dom'`; `location.pathname` | 4 files |
| `import { useSearchParams } from 'next/navigation'` | `import { useSearchParams } from 'react-router-dom'` | 2 files |
| `import Image from 'next/image'` | `<img>` tag | 2 files |
| `import Script from 'next/script'` | Manual `<script>` insertion | 1 file |
| `redirect(path)` (server) | `<Navigate to={path} />` or guard redirect | 8 files |
| `notFound()` (server) | `<Navigate to="/404" />` or throw in loader | 5 files |

---

## 8. Authentication Strategy

### Current Auth Flow

- `better-auth` with cookie-based sessions
- Server-side: `getSession()` reads cookies via `headers()` from `next/headers`
- Client-side: `useSession()` from `@/lib/auth-client.ts` (framework-agnostic)
- User creation hook auto-initializes `user_stats` and `user_preferences`

### Vite Auth Flow

The `better-auth` client SDK (`lib/auth-client.ts`) is already framework-agnostic and will work unchanged in Vite. The key change is:

1. **Client SDK**: Copy `lib/auth-client.ts` as-is. `signIn`, `signUp`, `signOut`, `useSession` all work via fetch to `/api/auth/*`.

2. **Backend**: The better-auth catch-all route (`app/api/auth/[...all]`) must be reimplemented in the backend framework but the `better-auth` handler (`auth.handler`) works with any framework.

3. **Auth Guard**: Replace server-side `redirect()` in layouts with a client-side `<AuthGuard>` component:

```typescript
function AuthGuard({ children }: { children: React.ReactNode }) {
  const { data: session, isPending } = useSession()
  const navigate = useNavigate()

  useEffect(() => {
    if (!isPending && !session) navigate('/sign-in', { replace: true })
  }, [session, isPending, navigate])

  if (isPending) return <LoadingSpinner />
  if (!session) return null
  return <>{children}</>
}
```

4. **CORS + Cookies**: The backend must be configured with proper CORS and `credentials: 'include'` for cookie-based auth to work cross-origin (if frontend and backend are on different domains). Alternatively, serve both from the same domain (e.g., `app.openlingo.dev` for frontend, `app.openlingo.dev/api` proxied to backend).

---

## 9. Data Fetching & State Management

### React Query (TanStack Query) Setup

React Query replaces the current pattern of "server components fetch data and pass as props to client components."

```typescript
// src/providers/query.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,      // 5 min default stale time
      gcTime: 1000 * 60 * 30,         // 30 min garbage collection
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
```

### Query Examples (replacing server component data fetching)

```typescript
// Current: Server component fetches directly
// app/(main)/layout.tsx
async function MainLayout({ children }) {
  const session = await getSession()           // server-side
  if (!session) redirect('/sign-in')
  const stats = await getUserStatsData()       // server-side
  const srsStats = await getSrsStats()         // server-side
  return <Sidebar stats={stats} srsStats={srsStats}>{children}</Sidebar>
}

// New: Client component with React Query
function MainLayout() {
  const { data: stats } = useQuery({ queryKey: ['user-stats'], queryFn: api.getStats })
  const { data: srsStats } = useQuery({ queryKey: ['srs-stats'], queryFn: api.getSrsStats })
  return <Sidebar stats={stats} srsStats={srsStats}><Outlet /></Sidebar>
}
```

### Replacing `router.refresh()` with Cache Invalidation

Currently, many components call `router.refresh()` after mutations to re-fetch server component data. In Vite:

```typescript
// Current
await completeLesson(data)
router.refresh()

// New
const queryClient = useQueryClient()
await api.completeLesson(data)
queryClient.invalidateQueries({ queryKey: ['user-stats'] })
queryClient.invalidateQueries({ queryKey: ['unit-progress', unitId] })
```

### API Client Module

```typescript
// src/api/client.ts
const API_BASE = import.meta.env.VITE_API_URL

async function fetchAPI<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    credentials: 'include',  // send auth cookies
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (!res.ok) {
    if (res.status === 401) throw new AuthError()
    throw new APIError(res.status, await res.text())
  }
  return res.json()
}
```

---

## 10. Component Migration Guide

### Tier 1: Copy As-Is (30+ components, 5 hooks)

These components have ZERO Next.js dependencies. Migration:
1. Copy file to `src/components/`
2. Remove `"use client"` directive (not needed in Vite)
3. Update import paths (`@/` -> `@/` -- same if alias is configured)

Components: all exercises (10), all word components (4), all article components (5), all UI components (6), gamification (2), chat-message, chat-exercise, tool-call, thinking-message, replay-button, audio-spinner, path-connector

Hooks: all 5 hooks

### Tier 2: Minor Import Changes (13 components)

These need `next/*` imports replaced:

| Component | Changes |
|-----------|---------|
| `sidebar.tsx` | `Link` -> RR Link, `usePathname` -> `useLocation` |
| `mobile-nav.tsx` | `Link` -> RR Link, `usePathname` -> `useLocation` |
| `top-bar.tsx` | `useRouter` -> `useNavigate` |
| `lesson-node.tsx` | `Link` -> RR Link |
| `sign-in-form.tsx` | `useRouter` -> `useNavigate`, `Image` -> `<img>`, `Link` -> RR Link |
| `sign-up-form.tsx` | Same as sign-in-form |
| `turnstile.tsx` | `Script` -> manual script loading |
| `posthog.tsx` | `usePathname`, `useSearchParams` -> RR equivalents |
| `onboarding-form.tsx` | `useRouter` -> `useNavigate`; server actions -> API calls |
| `chat-view.tsx` | `useRouter` -> `useNavigate`; server actions -> API calls |
| `chat-layout.tsx` | `Link`, `usePathname`, `useRouter` -> RR; server action -> API |
| `unit-card.tsx` (chat) | `useRouter` -> `useNavigate` |
| `article-card.tsx` | `useRouter` -> `useNavigate` |

### Tier 3: Server Action Replacement (20+ components)

Components that call server actions directly (e.g., `await updateTargetLanguage(lang)`) need those calls replaced with API fetches. Affected components:

| Component | Server Actions Used | API Replacement |
|-----------|-------------------|-----------------|
| `word-tooltip.tsx` | `addOrFailWord` | `POST /api/srs/add-or-fail` |
| `flashcard-review.tsx` | `reviewCard` | `POST /api/srs/review` |
| `chat-view.tsx` | `createConversation`, `saveMessages`, `recordChatExerciseResult`, `updatePreferredModel` | 4 API calls |
| `chat-layout.tsx` | `deleteConversation` | `DELETE /api/chat/:id` |
| `onboarding-form.tsx` | `updateTargetLanguage`, `updateNativeLanguage` | 2 API calls |
| `lesson-view.tsx` | `completeLesson` | `POST /api/lessons/complete` |
| `settings-view.tsx` | `updateTargetLanguage`, `updateNativeLanguage`, `updatePreferredModel` | 3 API calls |
| `prompt-editor.tsx` | `savePrompt`, `resetPrompt` | 2 API calls |
| `memory-editor.tsx` | `saveMemory` | `POST /api/memory` |
| `word-explorer.tsx` | `bulkAddWordsToSrs`, `removeAllWordsFromSrs`, `addWordToSrs`, `removeWordFromSrs`, `introduceNewCards` | 5 API calls |
| `standalone-units.tsx` | `makeUnitPublic`, `deleteUnit`, `removeUnitFromLibrary` | 3 API calls |
| `my-courses.tsx` | `makeCoursePublic`, `deleteCourse` | 2 API calls |
| `unit-editor.tsx` | `updateUnitMarkdown`, `makeUnitPublic`, `makeUnitPrivate`, `deleteUnit` | 4 API calls |
| `create-course-form.tsx` | `createCourse` | `POST /api/courses` |
| `course-manager.tsx` | `fetchCourseManagementData`, `addUnitToCourse`, `removeUnitFromCourse`, `deleteCourse` | 4 API calls |
| `browse-units.tsx` | `addUnitToLibrary` | `POST /api/library/add` |

### Tier 4: Server Components -> Client Pages (20 pages + 5 layouts)

Every `page.tsx` that is currently a server component needs to become a client component that fetches its data via React Query:

| Page | Server-Side Data Fetching | Client-Side Replacement |
|------|--------------------------|------------------------|
| Landing page | `getSession()`, `getGitHubStars()` | `useSession()`, `useQuery(['stars'])` |
| Main layout | `getSession()`, `getUserStatsData()`, `getSrsStats()`, `getGitHubStars()` | AuthGuard + `useQuery` for stats |
| Chat layout | `listConversations()` | `useQuery(['conversations'])` |
| Chat page | `getTargetLanguage()`, `getPreferredModel()`, `getModelsForUser()` | `useQuery(['preferences'])` |
| Chat [id] page | `getConversation(id)` | `useQuery(['conversation', id])` |
| Units page | `getStandaloneUnits()`, `getUserOwnedCourses()`, `isAdminEmail()` | Multiple `useQuery` calls |
| Units browse | `listCoursesWithLessonCounts()`, `getAvailableFilters()`, `getBrowsableUnits()` | Multiple `useQuery` calls |
| Units [courseId] | `getCourseWithContent()`, `getUserProgress()` | `useQuery(['course', id])` |
| Units edit | `getUnitForEdit()` | `useQuery(['unit-edit', id])` |
| Words page | `getTargetLanguage()`, `loadLanguageRaw()`, `getAllCards()`, `getSrsStats()` | Multiple `useQuery` calls |
| Read page | DB query for articles | `useQuery(['articles'])` |
| Read [id] | Already client component! | Minimal changes |
| Settings page | `getPrompts()`, `getMemory()`, `getTargetLanguage()`, `getNativeLanguage()` | Multiple `useQuery` calls |
| Lesson page | `getCourseWithContent()` | `useQuery(['course', id])` |
| Standalone unit | `getUnitWithContent()`, `getUnitProgress()` | Multiple `useQuery` calls |
| Onboarding | `getSession()`, `getTargetLanguage()`, `getNativeLanguage()` | AuthGuard + `useQuery` |

---

## 11. Caching Strategy (Service Worker / PWA)

### Why This Architecture Enables Great Caching

A Vite SPA separates the app shell (HTML/JS/CSS) from data (API calls), making caching straightforward:

1. **App Shell (Cache First)**: The HTML, JS bundles, CSS, and icons are served as static files. A service worker caches them aggressively. On repeat visits, the app loads instantly from cache.

2. **API Data (Network First with Cache Fallback)**: API responses are cached as a fallback. If the network is available, fresh data is used. If offline, cached data provides a degraded but functional experience.

3. **Dictionary Data (Cache First, Long TTL)**: Language dictionaries (1.4-15 MB each) are downloaded once per language and cached for 30 days.

4. **Audio (Cache First)**: TTS audio files are cached permanently after first play.

### Service Worker Configuration (vite-plugin-pwa)

```typescript
// In vite.config.ts VitePWA plugin:
workbox: {
  // Cache all built assets (JS, CSS, HTML, fonts, icons)
  globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],

  runtimeCaching: [
    // API calls: Network first, cache fallback (1 day TTL)
    {
      urlPattern: /\/api\/(srs|courses|units|preferences|profile|prompts|progress|chat\/conversations)/,
      handler: 'NetworkFirst',
      options: {
        cacheName: 'api-data',
        expiration: { maxEntries: 500, maxAgeSeconds: 86400 },
        networkTimeoutSeconds: 3,
      },
    },
    // Dictionary JSONs: Cache first (30 day TTL)
    {
      urlPattern: /\/words\/.*\.json$/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'dictionary',
        expiration: { maxEntries: 20, maxAgeSeconds: 2592000 },
        cacheableResponse: { statuses: [0, 200] },
      },
    },
    // TTS audio: Cache first (permanent)
    {
      urlPattern: /\/api\/tts\?key=/,
      handler: 'CacheFirst',
      options: {
        cacheName: 'tts-audio',
        expiration: { maxEntries: 1000, maxAgeSeconds: 31536000 },
      },
    },
    // AI chat: Network only (streaming, no cache)
    {
      urlPattern: /\/api\/chat$/,
      handler: 'NetworkOnly',
    },
  ],
}
```

### Cache Size Estimates

| Cache | Expected Size | Strategy |
|-------|--------------|----------|
| App shell (JS + CSS + HTML) | ~500 KB - 1 MB gzipped | Precache (built into SW) |
| API data cache | ~1-5 MB | Runtime cache, 1-day TTL |
| Dictionary (per language) | 1.4-15 MB (avg 6.7 MB) | Runtime cache, 30-day TTL |
| TTS audio | Variable (grows with use) | Runtime cache, 1-year TTL, max 1000 entries |
| **Total for typical user** | **~10-25 MB** | |

### Offline Capabilities

With this caching strategy, the app can provide:
- **Full offline**: Landing page, app shell, navigation
- **Partial offline**: Cached pages with stale data, exercise playback with cached audio
- **Online required**: AI chat, new TTS generation, article translation, SRS sync

---

## 12. Backend API Design

### Recommended Framework: Hono

Hono is recommended because:
- Lightweight, fast, runs on any runtime (Node, Bun, Cloudflare Workers, Deno)
- Built-in streaming support (critical for AI chat)
- First-class TypeScript support
- Compatible with better-auth
- Easy middleware composition

### API Route Structure

```
POST   /api/auth/*                    # better-auth catch-all
GET    /api/session                   # get current session + preferences + stats

# SRS
GET    /api/srs/cards?language=       # getAllCards
GET    /api/srs/due?language=&limit=  # getDueCards
GET    /api/srs/new?language=&limit=  # getNewCards
GET    /api/srs/stats?language=       # getSrsStats
POST   /api/srs/review               # reviewCard
POST   /api/srs/add                   # addWordToSrs
POST   /api/srs/add-or-fail          # addOrFailWord
POST   /api/srs/bulk-add             # bulkAddWordsToSrs
POST   /api/srs/introduce            # introduceNewCards
DELETE /api/srs/word                  # removeWordFromSrs
DELETE /api/srs/all?language=         # removeAllWordsFromSrs

# Chat
GET    /api/chat/conversations        # listConversations
GET    /api/chat/conversations/:id    # getConversation
POST   /api/chat/conversations        # createConversation
PUT    /api/chat/conversations/:id    # saveMessages
DELETE /api/chat/conversations/:id    # deleteConversation
POST   /api/chat/stream               # AI chat streaming (SSE)

# Courses & Units
GET    /api/courses?filters           # listCourses
GET    /api/courses/:id               # getCourseWithContent
GET    /api/courses/:id/progress      # getUserProgress
GET    /api/courses/:id/manage        # fetchCourseManagementData
POST   /api/courses                   # createCourse
DELETE /api/courses/:id               # deleteCourse
POST   /api/courses/:id/publish       # makeCoursePublic
POST   /api/courses/:id/unpublish     # makeCoursePrivate
POST   /api/courses/:id/units         # addUnitToCourse
DELETE /api/courses/:id/units/:unitId # removeUnitFromCourse

GET    /api/units/standalone          # getStandaloneUnits
GET    /api/units/browse              # getBrowsableUnits
GET    /api/units/:id                 # getUnitWithContent
GET    /api/units/:id/edit            # getUnitForEdit
GET    /api/units/:id/progress        # getUnitProgress
PUT    /api/units/:id/markdown        # updateUnitMarkdown
DELETE /api/units/:id                 # deleteUnit
POST   /api/units/:id/publish         # makeUnitPublic
POST   /api/units/:id/unpublish       # makeUnitPrivate

# Library
POST   /api/library/add              # addUnitToLibrary
DELETE /api/library/:unitId           # removeUnitFromLibrary

# Lessons
POST   /api/lessons/complete          # completeLesson

# Preferences
GET    /api/preferences               # getTargetLanguage, getNativeLanguage, getPreferredModel
PUT    /api/preferences/target-lang   # updateTargetLanguage
PUT    /api/preferences/native-lang   # updateNativeLanguage
PUT    /api/preferences/model         # updatePreferredModel

# Profile
GET    /api/profile                   # getProfileData
GET    /api/stats                     # getUserStatsData

# Prompts & Memory
GET    /api/prompts                   # getPrompts
PUT    /api/prompts/:id               # savePrompt
DELETE /api/prompts/:id               # resetPrompt
GET    /api/memory                    # getMemory
PUT    /api/memory                    # saveMemory

# Articles
GET    /api/articles                  # list articles
GET    /api/articles/:id              # get article
DELETE /api/articles/:id              # delete article
GET    /api/articles/:id/status       # get article status
GET    /api/articles/:id/timestamps   # get audio timestamps
GET    /api/articles/:id/audio        # get audio URL
POST   /api/articles/:id/audio        # generate audio

# Media
POST   /api/tts                       # generate speech
GET    /api/tts?key=                  # get cached audio
POST   /api/stt                       # transcribe speech
POST   /api/ai-prompt                 # generic AI prompt

# Words
GET    /api/words/lookup?word=&lang=  # lookupWord
```

### Backend Code Reuse

The backend can reuse most of the existing server code with minimal changes:

| Current File | Reuse Strategy |
|-------------|---------------|
| `lib/db/schema.ts` | Copy as-is |
| `lib/db/index.ts` | Copy as-is (Drizzle + postgres.js) |
| `lib/db/queries/courses.ts` | Copy as-is (all queries work) |
| `lib/auth.ts` | Copy, adapt handler for new framework |
| `lib/ai/models.ts` | Copy as-is |
| `lib/ai/tools.ts` | Copy as-is (tools are framework-agnostic) |
| `lib/article/*` | Copy as-is (article pipeline is self-contained) |
| `lib/tts.ts` | Copy as-is |
| `lib/r2.ts` | Copy as-is |
| `lib/words.ts` | Copy as-is |
| `lib/turnstile.ts` | Copy as-is |
| `lib/srs.ts` | Copy as-is (already pure) |
| `lib/actions/*.ts` | Extract logic from each function, wrap in route handlers |

**Estimated reusable code**: ~80% of server-side logic can be lifted directly. The main work is wrapping each function in an HTTP handler instead of a server action.

---

## 13. Dictionary & Content Strategy

### Seed Content (18 KB -- bundle)

The 11 markdown files in `content/` should be bundled with the Vite frontend:

```typescript
// src/content/index.ts
import testingCourse from '../../content/testing-course.md?raw'
import testingUnit0 from '../../content/testing-unit-0.md?raw'
// ... etc

import { parseCourseMarkdown, parseUnitMarkdown } from '@/lib/content'

export const seedCourses = [parseCourseMarkdown(testingCourse)]
export const seedUnits = [
  parseUnitMarkdown(testingUnit0),
  parseUnitMarkdown(testingUnit1),
  // ... etc
]
```

However, since all content is also in the database, the frontend should primarily fetch from the API. The bundled seed content serves as an offline fallback.

### Dictionary Data (94 MB -- lazy-load)

Strategy: Place JSON files in `public/words/` and lazy-load per language.

```typescript
// src/lib/dictionary.ts
const dictionaryCache = new Map<string, Map<string, DictionaryEntry>>()

export async function loadDictionary(language: string): Promise<Map<string, DictionaryEntry>> {
  if (dictionaryCache.has(language)) return dictionaryCache.get(language)!

  const response = await fetch(`/words/${getFilename(language)}.json`)
  const entries: RawEntry[] = await response.json()

  const map = new Map<string, DictionaryEntry>()
  for (const entry of entries) {
    map.set(entry.word.toLowerCase(), transformEntry(entry))
  }

  dictionaryCache.set(language, map)
  return map
}
```

The Service Worker caches the JSON files (CacheFirst, 30-day TTL), so after the first load, dictionary access is instant and offline-capable.

For the AI word lookup fallback (when a word isn't in the dictionary), the frontend calls `GET /api/words/lookup?word=X&lang=Y` which runs the AI analysis server-side.

---

## 14. AI Chat Streaming Migration

### Current Setup

```
Client: useChat() -> POST /api/chat (Next.js route handler)
Server: streamText() with tools -> toUIMessageStreamResponse() -> SSE stream
```

### Vite Setup

The `@ai-sdk/react` `useChat` hook is framework-agnostic. It just needs a URL to POST to:

```typescript
// Frontend
const { messages, input, handleSubmit } = useChat({
  api: `${import.meta.env.VITE_API_URL}/api/chat/stream`,
  // OR use transport:
  transport: new DefaultChatTransport({
    api: `${import.meta.env.VITE_API_URL}/api/chat/stream`,
    credentials: 'include',  // send auth cookies
  }),
})
```

The backend streaming endpoint is almost identical to the current Next.js route:

```typescript
// Backend (Hono example)
app.post('/api/chat/stream', authMiddleware, async (c) => {
  const { messages, language, model } = await c.req.json()
  const session = c.get('session')
  // ... same logic as current api/chat/route.ts ...
  const result = streamText({ model, system, messages, tools, maxSteps: 7 })
  return result.toUIMessageStreamResponse()
})
```

The AI SDK's `streamText` and `toUIMessageStreamResponse` are framework-agnostic -- they return a standard `Response` object with SSE streaming.

---

## 15. Key Design Decisions

### 1. Single Domain vs. Separate Domains

**Recommended: Same domain with path-based routing**

- Frontend: `openlingo.dev/*` (Vite static files)
- Backend: `openlingo.dev/api/*` (reverse proxy to API server)

This avoids CORS complexity and ensures cookies work seamlessly. Use a reverse proxy (nginx, Cloudflare, Vercel rewrites) to route `/api/*` to the backend.

### 2. React Router vs. TanStack Router

**Recommended: React Router v7** -- more mature ecosystem, wider community support, simpler API for this use case. TanStack Router has stronger type safety but adds complexity.

### 3. React Query vs. SWR

**Recommended: TanStack React Query v5** -- more powerful cache invalidation (critical for replacing `router.refresh()`), better devtools, support for optimistic updates, broader feature set.

### 4. Backend Framework: Hono vs. Express vs. Fastify

**Recommended: Hono** -- lightweight, TypeScript-first, runs everywhere (Node, Bun, Cloudflare Workers), built-in streaming support, excellent middleware. The current codebase uses Bun, and Hono works perfectly with Bun.

### 5. Monorepo vs. Separate Repos

**Recommended: Monorepo** with shared types/utilities:

```
openlingo/
  packages/
    shared/               # Shared types, content parsers, SRS algorithm
  apps/
    web/                  # Vite frontend
    api/                  # Hono backend
```

This allows sharing TypeScript types, content parsers, Zod schemas, and the SRS algorithm between frontend and backend.

### 6. Auth Cookies vs. JWT Tokens

**Keep cookie-based auth** (current approach). `better-auth` already handles this well. Cookies are more secure (HttpOnly, SameSite), work with the same-domain setup, and the client SDK already supports them.

### 7. Database: Keep PostgreSQL vs. Move to BaaS

**Keep PostgreSQL + Drizzle ORM on the backend.** The schema is mature (18+ tables), the queries are complex (multi-table joins, batch operations), and moving to a BaaS would require rewriting all 47 server actions. The Drizzle ORM code can be reused as-is.

### 8. Offline SRS: IndexedDB vs. Server-Only

**Server-only for now, with optional IndexedDB cache later.** The SRS system has 14 operations and complex state management. Starting with server-only keeps it simple. A future enhancement could sync SRS state to IndexedDB for offline review.

---

## 16. Risk Assessment & Edge Cases

### High Risk

1. **Cookie auth cross-origin**: If frontend and backend are on different domains, cookies won't work without SameSite=None + Secure. **Mitigation**: Use same-domain setup with reverse proxy.

2. **AI chat streaming**: The SSE stream must work through any CDN/proxy layers. Some CDN configurations buffer SSE responses. **Mitigation**: Configure CDN to disable buffering for `/api/chat/stream`, or use WebSocket transport.

3. **Large dictionary files**: 15 MB JSON files may cause memory issues on low-end mobile devices. **Mitigation**: Consider streaming JSON parsing or IndexedDB storage instead of in-memory Map.

### Medium Risk

4. **SEO for public pages**: The standalone unit pages currently use `generateMetadata()` for OG tags. A pure SPA won't have server-rendered meta tags. **Mitigation**: Use a prerendering service (prerender.io) or a lightweight SSR solution just for public pages.

5. **Initial load time**: Without SSR, the first meaningful paint is slower. **Mitigation**: Code splitting (React.lazy), skeleton loading states, and aggressive Service Worker precaching of the app shell.

6. **Race conditions with cache invalidation**: React Query cache invalidation after mutations may cause brief stale data. **Mitigation**: Use optimistic updates where appropriate (e.g., SRS card review).

7. **Fire-and-forget background jobs**: Article translation and audio generation currently run as fire-and-forget after the HTTP response. The backend needs a proper pattern for this. **Mitigation**: In Hono/Bun, use `c.executionCtx.waitUntil()` or a simple job queue (BullMQ, or Bun's built-in background tasks).

### Low Risk

8. **Tailwind v4 compatibility**: Tailwind v4 has native Vite support via `@tailwindcss/vite` plugin. The existing CSS should work as-is.

9. **PostHog**: The PostHog JS SDK is framework-agnostic. Just need to hook into React Router navigation events instead of Next.js's `usePathname`.

10. **Turnstile**: Cloudflare Turnstile is loaded via a `<script>` tag. Replacing `next/script` with a manual `<script>` insertion is trivial.

---

## 17. Implementation Todo List

### Phase 1: Project Setup (1-2 days)
- [ ] Initialize Vite + React 19 + TypeScript project
- [ ] Configure `@tailwindcss/vite` plugin
- [ ] Set up path aliases (`@/` -> `src/`)
- [ ] Install React Router v7 and define route structure
- [ ] Install TanStack React Query v5
- [ ] Install Geist fonts (via @fontsource or CDN)
- [ ] Copy `globals.css` (works as-is)
- [ ] Copy `public/` assets (minus next.svg, vercel.svg)
- [ ] Set up environment variables (`VITE_*`)
- [ ] Configure `vite-plugin-pwa` with Service Worker

### Phase 2: Copy Pure Modules (0.5 day)
- [ ] Copy all `lib/content/` files (except loader.ts loadContentDir, registry.ts)
- [ ] Copy `lib/srs.ts`, `lib/srs-words.ts`
- [ ] Copy `lib/languages.ts`, `lib/constants.ts`, `lib/colors.ts`, `lib/similarity.ts`
- [ ] Copy `lib/auth-client.ts` (update base URL to `VITE_API_URL`)
- [ ] Create content module with `?raw` imports for seed markdown
- [ ] Move dictionary JSONs to `public/words/`

### Phase 3: Copy Pure Components (1 day)
- [ ] Copy all 30+ zero-dependency components (remove "use client")
- [ ] Copy all 5 hooks (remove "use client")
- [ ] Verify imports resolve correctly
- [ ] Smoke test each component renders

### Phase 4: Backend API Setup (3-4 days)
- [ ] Initialize Hono + Bun project
- [ ] Set up Drizzle ORM (copy schema, DB connection)
- [ ] Implement better-auth handler
- [ ] Implement auth middleware (`requireSession`)
- [ ] Create route handlers for all 47 server actions (grouped by domain):
  - [ ] SRS routes (14 endpoints)
  - [ ] Chat conversation routes (5 endpoints)
  - [ ] Course/unit routes (11 endpoints)
  - [ ] Preferences routes (4 endpoints)
  - [ ] Profile routes (3 endpoints)
  - [ ] Prompts/memory routes (6 endpoints)
  - [ ] Lesson routes (1 endpoint)
  - [ ] Library routes (2 endpoints)
- [ ] Migrate existing API routes:
  - [ ] Chat streaming (POST /api/chat/stream)
  - [ ] Word lookup (GET /api/words/lookup)
  - [ ] AI prompt (POST /api/ai-prompt)
  - [ ] TTS (GET + POST /api/tts)
  - [ ] STT (POST /api/stt)
  - [ ] Articles (7 endpoints)
- [ ] Implement CORS middleware
- [ ] Add auth to currently unprotected routes (STT, TTS)

### Phase 5: API Client Layer (1 day)
- [ ] Create typed API client module (`src/api/client.ts`)
- [ ] Create domain-specific API modules:
  - [ ] `src/api/auth.ts`
  - [ ] `src/api/srs.ts`
  - [ ] `src/api/chat.ts`
  - [ ] `src/api/courses.ts`
  - [ ] `src/api/preferences.ts`
  - [ ] `src/api/profile.ts`
  - [ ] `src/api/prompts.ts`
  - [ ] `src/api/lessons.ts`
  - [ ] `src/api/articles.ts`
  - [ ] `src/api/media.ts`
  - [ ] `src/api/words.ts`
- [ ] Create React Query hooks for each data-fetching operation

### Phase 6: Migrate Components with Next.js Deps (2 days)
- [ ] Replace `next/link` -> React Router `Link` (18 files)
- [ ] Replace `next/navigation` hooks -> React Router hooks (25 files)
- [ ] Replace `next/image` -> `<img>` (2 files)
- [ ] Replace `next/script` -> manual script loading (1 file)
- [ ] Update PostHog provider for React Router
- [ ] Replace all server action calls with API client calls (~20 components)
- [ ] Replace `router.refresh()` with `queryClient.invalidateQueries()` (6 files)

### Phase 7: Convert Server Component Pages (3-4 days)
- [ ] Create `AuthGuard` component
- [ ] Convert root layout -> `App.tsx` with providers
- [ ] Convert auth layout -> `AuthLayout.tsx`
- [ ] Convert main layout -> `MainLayout.tsx` with React Query data fetching
- [ ] Convert public-or-auth layout -> `PublicOrAuthLayout.tsx`
- [ ] Convert each page to client component:
  - [ ] Landing page
  - [ ] Sign-in / sign-up / onboarding pages
  - [ ] Chat layout + chat pages (new, [id])
  - [ ] Units page + browse + edit + course detail
  - [ ] Words page
  - [ ] Read list + article detail (already client!)
  - [ ] Settings page
  - [ ] Lesson page
  - [ ] Standalone unit + lesson pages
- [ ] Implement loading states / skeletons
- [ ] Implement 404 page

### Phase 8: AI Chat Integration (1 day)
- [ ] Configure `useChat` with backend URL + credentials
- [ ] Verify streaming works end-to-end
- [ ] Test all 9 AI tools (memory, SRS, exercise, unit creation, article, language switch)
- [ ] Verify exercise rendering in chat works

### Phase 9: PWA & Caching (1 day)
- [ ] Configure Service Worker precaching for app shell
- [ ] Configure runtime caching strategies for API, dictionaries, audio
- [ ] Test offline behavior
- [ ] Test "install as app" flow
- [ ] Verify cache invalidation on app updates

### Phase 10: Testing & Polish (2-3 days)
- [ ] End-to-end test all user flows:
  - [ ] Sign up -> onboarding -> first chat
  - [ ] Complete a lesson -> check stats update
  - [ ] SRS review flow
  - [ ] Create unit via chat -> edit -> publish
  - [ ] Read an article -> play audio -> reading mode
  - [ ] Words page -> bulk add -> review
  - [ ] Settings -> change language -> verify chat uses new language
- [ ] Test mobile responsiveness
- [ ] Test PWA install + offline
- [ ] Performance audit (Lighthouse)
- [ ] Fix any regressions

### Estimated Total: 15-20 days for a single developer

---

## Appendix: Files That Can Be Deleted (Next.js Specific)

| File | Reason |
|------|--------|
| `next.config.ts` | Next.js config |
| `proxy.ts` | Next.js middleware |
| `app/` (entire directory) | Replaced by Vite src/ |
| `postcss.config.mjs` | Replaced by Vite's Tailwind plugin |
| `eslint.config.mjs` | Can be recreated for Vite |
| `public/next.svg` | Next.js branding |
| `public/vercel.svg` | Vercel branding |
| All `loading.tsx` files | Replaced by React Query loading states |
| All `layout.tsx` server components | Converted to client layouts |
| All `page.tsx` server components | Converted to client pages |
