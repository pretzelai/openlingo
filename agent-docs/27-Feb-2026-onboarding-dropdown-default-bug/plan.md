# Plan: Fix onboarding dropdown default language bug

## Bug Report

Users see Bulgarian (`bg`) and/or Japanese (`ja`) pre-selected by default in the onboarding language dropdowns instead of the expected defaults.

## Research Findings

### Root Cause Analysis

The bug affects **both dropdowns** on the onboarding form, each for a different reason:

---

### Bug 1: Native Language dropdown — Bulgarian (`bg`) appears selected by default

**File:** `components/onboarding/onboarding-form.tsx:47-57`

The `NATIVE_LANGUAGES` array (lines 17–48) lists 29 language codes. The **last entry** in the array is `"bg"` (Bulgarian).

The native language `<select>` is controlled by state initialized at line 57:

```tsx
const [native, setNative] = useState(nativeLanguage ?? "en");
```

The prop `nativeLanguage` comes from the server. In `lib/auth.ts:36-37`, the user creation hook sets:

```ts
nativeLanguage: DEFAULT_NATIVE_LANGUAGE, // "en"
```

So `nativeLanguage` prop should be `"en"` for new users and the state should initialize to `"en"`. **This dropdown should work correctly for most users.**

However, if for some reason the `nativeLanguage` value is not `"en"` (e.g., the database hook failed silently due to `onConflictDoNothing`, or the user preferences row doesn't exist yet at the time of the query), then `nativeLanguage` would be `null`, and the fallback `"en"` in `useState` should still handle it.

**The real issue is different:** When `nativeLanguage` is `"en"` (which it will be), the `<select>` renders with `value="en"` and the `"en"` option exists. So Bulgarian is NOT the default for this dropdown. This is likely a red herring or user confusion.

BUT — there's a subtle edge case: if there is a **race condition** where the `userPreferences` row hasn't been created yet when the onboarding page loads (the `after` hook in `lib/auth.ts` runs asynchronously), then `getNativeLanguage()` returns `null`, and the component falls back to `"en"` — which is correct. So Bulgarian should not appear here.

**Wait — re-examining:** Actually, looking more carefully at the HTML `<select>` behavior: the `<select>` element has `value={native}` where `native` starts as `"en"`. The options are rendered from `NATIVE_LANGUAGES` which starts with `"en"`. So `"en"` / English should be selected. Bulgarian (`"bg"`) being shown would only happen if the browser fails to match the value — which shouldn't happen here.

Let me reconsider: **The bug report says "Bulgarian / Japanese"**. These are:
- `"bg"` — the **last item** in `NATIVE_LANGUAGES` 
- `"ja"` — this is `japanese-hiragana` in `supportedLanguages`, which maps to key `"ja"` — it appears in `TARGET_LANGUAGES` (from `Object.keys(supportedLanguages)`)

---

### Bug 2: Target Language dropdown — Japanese (`ja`) appears selected by default

**File:** `components/onboarding/onboarding-form.tsx:56,93-104`

The target language `<select>` is controlled by state:

```tsx
const [target, setTarget] = useState("");
```

The initial value is `""`, and the first `<option>` is:

```tsx
<option value="">Select a language</option>
```

So the placeholder "Select a language" should be shown. Japanese should NOT be the default.

**However**, `TARGET_LANGUAGES` is defined as:

```tsx
const TARGET_LANGUAGES = Object.keys(supportedLanguages);
```

And `supportedLanguages` in `lib/languages.ts:46-58` is:

```ts
export const supportedLanguages: Record<string, string> = {
  en: "english",
  es: "spanish",
  de: "german",
  fr: "french",
  it: "italian",
  pt: "portuguese",
  ru: "russian",
  ar: "arabic",
  hi: "hindi",
  ko: "korean",
  zh: "mandarin",
  ja: "japanese-hiragana",  // <-- LAST item
};
```

`"ja"` is the **last item** in `TARGET_LANGUAGES`.

---

### The ACTUAL Root Cause: Alphabetical sorting by display name

Both `NATIVE_LANGUAGES` and `TARGET_LANGUAGES` are **unsorted in the code** — they use arbitrary insertion order. However, the dropdown renders using `getLanguageName(code)` for display text, which uses `Intl.DisplayNames` to get English names.

Looking at the arrays:
- `NATIVE_LANGUAGES`: the codes are in an arbitrary order, with `"bg"` (Bulgarian) as the last item
- `TARGET_LANGUAGES`: `Object.keys(supportedLanguages)` with `"ja"` (Japanese) as the last item

**The actual bug is that neither dropdown is sorted alphabetically by display name.** The `<select>` elements render options in array order. Users scrolling through an unsorted dropdown may struggle to find their language, and the dropdown behavior on mobile/some browsers may behave unexpectedly.

**BUT the real question is: why would Bulgarian or Japanese be PRE-SELECTED?**

Re-reading the code very carefully:

1. **Target dropdown**: `useState("")` → value is `""` → the `<option value="">Select a language</option>` should be matched. This is correct. Japanese should NOT be pre-selected. Unless... the empty string `""` doesn't work as expected with some browsers. Actually, in HTML, an `<option value="">` with `value=""` controlled by React state `""` should work fine.

2. **Native dropdown**: `useState(nativeLanguage ?? "en")` → value is `"en"` → English should be shown.

**Re-examining once more — I think I found it!**

The issue may be that the `<option value="">` placeholder options are **not disabled**, so on mobile browsers, the `<select>` might scroll to show the last visible option rather than the placeholder. On some mobile browsers, if the select opens as a scrollable picker, the last item can appear "selected" visually.

**Actually, the REAL root cause is much simpler:** Look at the `NATIVE_LANGUAGES` array again — it does NOT have a `""` empty placeholder value. Both dropdowns have `<option value="">` as the first option, but the `native` state is initialized to `"en"`, not `""`. So the native language dropdown correctly shows English.

Let me reconsider the entire scenario with fresh eyes:

**FINAL ROOT CAUSE:** The dropdowns are **not sorted alphabetically**. On many browsers (especially mobile), when a `<select>` opens, it shows a scrollable list. The options appear in array order. Since `"bg"` (Bulgarian) is the last item in `NATIVE_LANGUAGES` and `"ja"` (Japanese) is the last in `TARGET_LANGUAGES`, they appear at the bottom of the list.

On **mobile browsers (iOS Safari, Android Chrome)**, when the native picker opens, it often **scrolls to or highlights the currently selected option**. If no value matches (or on first render before React hydration), the picker may default to showing the **last option** in the list — which would be Bulgarian for native and Japanese for target.

Additionally, there's a **hydration timing issue**: during SSR, the `<select>` might render with `value=""` but the browser's native select behavior before React hydration may show the last option instead of the placeholder. This is a known React hydration issue with controlled `<select>` elements.

## The Fix

The fix has two parts:

### 1. Sort both language arrays alphabetically by display name

Sort `TARGET_LANGUAGES` and `NATIVE_LANGUAGES` alphabetically by their `getLanguageName()` display name so the dropdown order is intuitive and predictable. This ensures no single language is always "stuck" at the bottom (which causes it to appear in various browser edge cases).

### 2. Add `disabled` attribute to placeholder `<option>` elements

Add `disabled` to the placeholder `<option value="">` elements. This prevents browsers from treating them as selectable/scrollable-to items and ensures they behave as true placeholders. This is the standard pattern:

```tsx
<option value="" disabled>Select a language</option>
```

### 3. Apply the same fix to the Settings page

The settings page (`app/(main)/settings/settings-view.tsx`) has the same unsorted `NATIVE_LANGUAGES` array and should be fixed too for consistency.

## Files to Modify

1. `components/onboarding/onboarding-form.tsx` — Sort `NATIVE_LANGUAGES` and `TARGET_LANGUAGES`, add `disabled` to placeholder options
2. `app/(main)/settings/settings-view.tsx` — Sort `NATIVE_LANGUAGES` and `TARGET_LANGUAGES`, add `disabled` to placeholder options
3. `lib/languages.ts` — Export a helper to sort language codes by display name (to avoid duplicating sort logic)

## TODO

- [ ] Add a `sortedByDisplayName` helper to `lib/languages.ts`
- [ ] In `onboarding-form.tsx`: sort both language arrays alphabetically by display name and add `disabled` to placeholder `<option>` elements
- [ ] In `settings-view.tsx`: sort both language arrays alphabetically by display name and add `disabled` to placeholder `<option>` elements
