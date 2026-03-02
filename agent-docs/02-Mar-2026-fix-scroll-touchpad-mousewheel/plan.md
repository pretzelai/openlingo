# Fix: Touchpad/Mousewheel Scrolling Broken on /words, /units, /read

## Problem

Scrolling with touchpad or mousewheel does not work on the `/words`, `/units`, and `/read` routes. The `/chat` route works fine.

## Root Cause Analysis

The root cause is `overscroll-behavior: none` on `html, body` in `app/globals.css` (line 50):

```css
html,
body {
  overflow-x: hidden;
  overscroll-behavior: none;
}
```

**However**, `overscroll-behavior: none` alone should not block scrolling — it only prevents overscroll bounce/chaining. The real problem is how the layout hierarchy interacts with the viewport.

### Layout Structure for `/words`, `/units`, `/read`

These routes all render through the `(main)` layout (`app/(main)/layout.tsx`):

```
<html>                          ← overflow-x: hidden, overscroll-behavior: none
  <body>                        ← overflow-x: hidden, overscroll-behavior: none
    <div class="min-h-screen bg-lingo-bg">   ← root wrapper
      <Sidebar/>                              ← fixed, desktop only
      <div class="md:pl-64">                  ← content column
        <TopBar/>                             ← sticky top-0
        <main class="p-4 pb-20 md:p-8 md:pb-8">  ← main content
          {children}                          ← page content
        </main>
      </div>
      <MobileNav/>                            ← fixed bottom
    </div>
```

The page content (e.g. word list, unit cards, article list) flows naturally inside `<main>`. The document body **should** scroll naturally with regular overflow.

### Why /chat Works

The chat route uses `ChatLayout` which sets:
```
<div class="-m-4 md:-m-8 md:-mb-8 relative flex h-[calc(100dvh-9rem)] md:h-[calc(100vh-4rem)]">
```

This creates a **fixed-height container** that fills the viewport. Inside it, `ChatView` uses:
```
<div class="absolute inset-0 overflow-y-auto overflow-x-hidden touch-pan-y">
```

So chat has its **own scroll container** with explicit `overflow-y-auto`. It doesn't rely on body scroll at all.

### The Real Issue

After deeper analysis, the actual issue is:

1. The `overscroll-behavior: none` on `html, body` is suspicious but not the primary blocker.
2. The **real problem** is that on some browsers/platforms (especially with touchpad and precision scrolling), having `overscroll-behavior: none` on BOTH `html` AND `body` can interfere with native scroll propagation — particularly when the page uses `min-h-screen` (which means the outer div is at least 100vh) combined with a sticky header and fixed bottom nav.

On touch/trackpad devices, the browser's scroll chain goes: element → body → html → viewport. When `overscroll-behavior: none` is set on both `html` and `body`, and the content is just barely at or near viewport height (especially with mobile bottom nav taking space), the browser can misidentify the scroll target or suppress the scroll event chain.

Additionally, the `min-h-screen` class on the root div means content that barely overflows may not trigger a scrollbar, and trackpad/wheel delta events can get swallowed when the browser thinks there's nowhere to scroll.

### Key Difference

- `/chat`: Has its own `overflow-y-auto` scroll container (an absolutely positioned div filling the parent). Does NOT rely on body/document scroll. **Works.**
- `/words`, `/units`, `/read`: Rely entirely on **body/document scroll** for their content. Content flows naturally inside `<main>`. **Broken.**

## Solution

The fix should ensure the content area for non-chat routes has a proper scroll container, rather than relying on body-level scrolling which is being suppressed.

### Approach: Add explicit scroll container to the `(main)` layout

Modify `app/(main)/layout.tsx` to make the content column a proper scroll container with a fixed viewport height:

```tsx
<div className="min-h-screen bg-lingo-bg">
  <Sidebar />
  <div className="md:pl-64 flex flex-col h-screen">
    <TopBar stats={stats} githubStars={githubStars} />
    <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-8 md:pb-8">
      {children}
    </main>
  </div>
  <MobileNav />
</div>
```

By making the content column `h-screen` + `flex flex-col`, and making `<main>` `flex-1 overflow-y-auto`, we create an explicit scroll container for the main content area. This mirrors how chat already works (its own scroll container), and ensures touchpad/wheel events are handled by an element with explicit `overflow-y-auto`.

### Edge Cases & Considerations

1. **Mobile bottom nav**: The `pb-20` on main already accounts for the fixed bottom nav on mobile. The `md:pb-8` handles desktop. This stays the same.
2. **Sticky TopBar**: Currently `sticky top-0`. Inside a flex column with the main area scrollable, we can keep it as-is (it sits above the scrollable main, not inside it, so sticky is no longer needed — it naturally stays at the top). We can simplify it to just be a non-sticky header since the flex layout pins it at the top anyway. However, to minimize changes, we can leave the `sticky top-0` — it won't hurt inside a flex container.
3. **Chat route**: Chat already manages its own scroll via `ChatLayout`. Inside the new scrollable `<main>`, `ChatLayout` uses negative margins (`-m-4 md:-m-8`) and fixed heights to break out and fill the container. The `overflow-y-auto` on main won't conflict because ChatLayout's children have their own overflow containers, and the ChatLayout div itself exactly fills the available space (no overflow on main for chat pages).
4. **`overscroll-behavior: none`**: We should also scope this more precisely. It should stay on `html` (to prevent browser back/forward gestures from overscroll) but can be removed from `body` or kept — it's a secondary concern. The primary fix is the scroll container.
5. **`dvh` vs `vh` vs `screen`**: Using `h-screen` (100vh) is fine for the outer container since the sidebar and content column are full-height. On mobile, `100dvh` would be more accurate (accounts for dynamic browser chrome), but `min-h-screen` was already used, so `h-screen` is consistent. We could use `h-dvh` for better mobile support.

## Implementation Plan (Todo)

1. **Edit `app/(main)/layout.tsx`**: Change the content column wrapper (`md:pl-64` div) to be a `flex flex-col h-dvh` container, and add `flex-1 overflow-y-auto` to `<main>`.
2. **Edit `app/globals.css`**: Optionally refine the `overscroll-behavior` to only apply to `html` (not body), reducing the chance of scroll suppression.
3. **Verify chat still works**: Ensure the ChatLayout negative-margin trick still functions correctly inside the new scrollable main.
4. **Test**: Run the build to ensure no errors.
