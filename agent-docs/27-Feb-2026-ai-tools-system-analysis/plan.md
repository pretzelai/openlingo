# AI Tools System - Complete Analysis & Plan

## Executive Summary

The AI tools system in this codebase is a **language-learning tutor** app called **OpenLingo**. It uses the Vercel AI SDK (`ai` package) to connect an LLM to a set of server-side tools that manage user memory, SRS (spaced repetition) flashcards, exercises, learning units, language switching, and article translation.

---

## 1. Architecture Overview

### File Dependency Graph

```
app/api/chat/route.ts          (HTTP endpoint - POST handler)
  ├── lib/ai/index.ts           (barrel re-exports)
  │   ├── lib/ai/models.ts      (provider registry + model resolution)
  │   └── lib/ai/tools.ts       (all tool definitions)
  ├── lib/prompts/index.ts      (barrel re-exports)
  │   ├── lib/prompts/prompts.ts        (template engine + langCodeToName)
  │   ├── lib/prompts/chat-system.ts    (system prompt template)
  │   └── lib/prompts/srs-reference.ts  (SRS DDL + SM-2 algorithm reference)
  ├── lib/content/exercise-syntax.ts    (exercise syntax reference)
  ├── lib/actions/prompts.ts            (user-customizable prompt overrides)
  ├── lib/actions/preferences.ts        (getTargetLanguage)
  ├── lib/actions/profile.ts            (getNativeLanguage)
  ├── lib/db/                           (Drizzle ORM + schema)
  └── lib/constants.ts                  (DEFAULT_AI_MODEL = "claude-sonnet-4-6")
```

### Frontend Tool Rendering

```
components/chat/chat-message.tsx     (renders tool parts in messages)
  ├── components/chat/tool-call.tsx   (generic collapsible tool UI)
  ├── ChatExercise component          (for presentExercise tool)
  ├── ChatUnitCard component          (for createUnit tool)
  └── ArticleCard component           (for readArticle tool)
```

---

## 2. File-by-File Detailed Analysis

---

### 2.1 `/repo/lib/ai/tools.ts` — Tool Definitions (501 lines)

This is the core file. It exports a single factory function `createTools(userId, language?)` that returns a plain object where each key is a tool name and each value is created with the `tool()` helper from the `ai` package.

#### Imports

```ts
import { tool } from "ai";                          // Vercel AI SDK tool helper
import { z } from "zod";                             // Schema validation
import { revalidatePath } from "next/cache";         // Next.js ISR revalidation
import { db, client } from "@/lib/db";               // Drizzle ORM + raw postgres client
import { ... } from "@/lib/db/schema";               // Table schemas
import { and, eq, gte, lte } from "drizzle-orm";     // Query operators
import { parseExercise } from "@/lib/content/parser"; // Exercise markdown parser
import { langCodeToName } from "@/lib/prompts";       // Language code lookup
import { supportedLanguages } from "@/lib/languages"; // Supported language registry
import { parseUnitMarkdown } from "@/lib/content/loader"; // Unit markdown parser
```

#### Security Constants

```ts
const ALLOWED_TABLE = /\bsrs_card\b/i;
const FORBIDDEN_TABLES = /\b(user|session|account|verification|user_stats|...)\b/i;
```

These regex guards are used by the `srs` tool to ensure the AI can only run SQL against the `srs_card` table.

#### Factory Function Signature

```ts
export function createTools(userId: string, language?: string)
```

- `userId`: The authenticated user's ID. Captured in closure and used by all tools for data scoping.
- `language`: Optional target language code (e.g. "de"). Falls back as needed in individual tools.

#### Tool Definitions (9 tools total)

---

##### Tool 1: `readMemory`

- **Description**: "Read everything stored in the user's memory. Returns free-text notes that accumulate over time."
- **Input Schema**: `z.object({})` — no parameters
- **Execute**: Queries `userMemory` table where `userId` matches and `key = "memory"`. Returns `{ found: boolean, value: string }`.
- **Pattern**: Simple read, no side effects.

##### Tool 2: `addMemory`

- **Description**: "Append a line to the user's memory. The text is added after a line break at the end of existing memory."
- **Input Schema**: `z.object({ text: z.string() })`
- **Execute**: 
  1. Reads existing memory
  2. Appends new text with `\n` separator
  3. Upserts using `onConflictDoUpdate` on `[userId, key]`
- **Pattern**: Read-then-upsert. Returns `{ success: true }`.

##### Tool 3: `rewriteAllMemory`

- **Description**: "Replace the user's entire memory with new content. Use when memory needs to be reorganized or cleaned up."
- **Input Schema**: `z.object({ value: z.string() })`
- **Execute**: Direct upsert, replacing entire memory value.
- **Pattern**: Destructive write, upsert. Returns `{ success: true }`.

##### Tool 4: `srs`

- **Description**: "Execute SQL on the srs_card table. $1 is always bound to the current user's ID."
- **Input Schema**: `z.object({ sql: z.string() })`
- **Execute**:
  1. Validates query references `srs_card` (ALLOWED_TABLE)
  2. Validates query does NOT reference any FORBIDDEN_TABLES
  3. Executes raw SQL via `client.unsafe(query, [userId])` — `$1` is bound to userId
  4. Returns `{ rows, count }` for SELECTs, `{ affected }` for mutations
- **Error Handling**: Returns `{ error: string }` on validation failure or SQL errors. **Does not throw.**
- **Pattern**: Raw SQL with regex-based guardrails. The AI writes actual SQL queries referencing the DDL from the system prompt.

##### Tool 5: `presentExercise`

- **Description**: "Present an interactive exercise to the user."
- **Input Schema**: `z.object({ markdown: z.string() })`
- **Execute**: Calls `parseExercise(markdown)` to parse exercise markdown into a typed Exercise object.
- **Error Handling**: try/catch, returns `{ success: false, error }` on parse failure.
- **Pattern**: The AI generates exercise markdown using the exercise syntax reference from the system prompt. The parsed result is rendered as an interactive widget on the frontend via `ChatExercise`.

##### Tool 6: `createUnit`

- **Description**: "Create a learning unit from exercise markdown."
- **Input Schema**: 
  ```ts
  z.object({
    markdown: z.string(),
    courseId: z.string().uuid().optional()
  })
  ```
- **Execute**:
  1. Reads user preferences for fallback language
  2. Strips markdown code fences if present
  3. Parses with `parseUnitMarkdown(cleaned)`
  4. Generates UUID for unitId
  5. Inserts into `unit` table with all metadata
  6. Ensures `userStats` row exists (onConflictDoNothing)
  7. Calls `revalidatePath("/units", "page")` for ISR
  8. Returns rich metadata: `{ success, unitId, title, description, icon, color, level, lessonCount, exerciseCount, lessonTitles, url }`
- **Error Handling**: try/catch on parse, returns `{ success: false, error }`.
- **Pattern**: Complex multi-step DB operation. Frontend renders a `ChatUnitCard` component from the output.

##### Tool 7: `addWordsToSrs`

- **Description**: "Bulk-add words from the dictionary to the user's SRS deck."
- **Input Schema**:
  ```ts
  z.object({
    language: z.string(),
    cefrLevel: z.enum(["A1","A2","B1","B2","C1","C2"]).optional(),
    minFrequency: z.number().int().optional(),
    maxFrequency: z.number().int().optional(),
    limit: z.number().int().min(1).max(5000).default(500)
  })
  ```
- **Execute**:
  1. Builds dynamic filter conditions
  2. Queries `dictionaryWord` table
  3. Batch-inserts into `srsCard` in chunks of 500
  4. Uses `onConflictDoNothing` to skip duplicates
- **Pattern**: Batch insert with chunking. Returns `{ success, totalMatched, message }`.

##### Tool 8: `switchLanguage`

- **Description**: "Switch the user's target language and/or native language."
- **Input Schema**:
  ```ts
  z.object({
    target_language: z.string().optional(),
    native_language: z.string().optional()
  })
  ```
- **Execute**:
  1. Validates at least one language is provided
  2. Validates against `supportedLanguages` registry
  3. Upserts `userPreferences` for each changed language
  4. Calls `revalidatePath("/")`
- **Error Handling**: Returns descriptive error with list of supported languages.
- **Pattern**: Validation-then-upsert with revalidation.

##### Tool 9: `readArticle`

- **Description**: "Read a web article and translate it to a target language at a CEFR level."
- **Input Schema**:
  ```ts
  z.object({
    url: z.string().url(),
    cefrLevel: z.enum(["A1","A2","B1","B2","C1","C2"]).default("B1"),
    targetLanguage: z.string().optional()
  })
  ```
- **Execute**:
  1. Lazy-imports `processTranslation` (to avoid loading jsdom at boot)
  2. Checks for existing article with same URL + language + level
  3. If completed, returns existing. If in-progress, returns status.
  4. Creates new article record with status "fetching"
  5. Fires background `processTranslation()` (fire-and-forget with `.catch()` error logging)
  6. Calls `revalidatePath("/read", "page")`
- **Pattern**: Lazy import, deduplication, background processing (fire-and-forget). Frontend renders an `ArticleCard`.

---

### 2.2 `/repo/lib/ai/index.ts` — Barrel Exports (8 lines)

```ts
export { getModel, AVAILABLE_MODELS, CHAT_AVAILABLE_MODELS, isAdminEmail, getModelsForUser } from "./models";
export { createTools } from "./tools";
```

Clean barrel file. Everything from the AI subsystem is imported through `@/lib/ai`.

---

### 2.3 `/repo/lib/ai/models.ts` — Model Registry (69 lines)

#### Provider Setup

Three providers are configured using AI SDK provider factories:
- `google` (Google Generative AI) — `GOOGLE_AI_API_KEY`
- `openai` (OpenAI) — `OPENAI_API_KEY`
- `anthropic` (Anthropic) — `ANTHROPIC_API_KEY`

All three are registered into a single `createProviderRegistry({ google, openai, anthropic })`.

#### Available Models

```ts
AVAILABLE_MODELS = [
  { id: "gemini-3-flash-preview", label: "Gemini 3 Flash", provider: "google" },
  { id: "gemini-3-pro-preview", label: "Gemini 3 Pro", provider: "google" },
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", provider: "google" },
  { id: "gpt-4o", label: "GPT-4o", provider: "openai" },
  { id: "gpt-4o-mini", label: "GPT-4o Mini", provider: "openai" },
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "anthropic" },
  { id: "claude-opus-4-6", label: "Claude Opus 4.6", provider: "anthropic" },
];
```

#### Access Control

- `CHAT_AVAILABLE_MODELS` — filters to only `claude-sonnet-4-6` for non-admin users.
- `isAdminEmail(email)` — checks against comma-separated `ADMIN_EMAILS` env var.
- `getModelsForUser(email)` — returns full list for admins, restricted list for others.

#### Model Resolution

```ts
function getModel(id: string) {
  const resolved = AVAILABLE_MODELS.find(m => m.id === id)?.provider + ":" + id;
  return registry.languageModel(resolved);
}
```

Constructs a `"provider:model-id"` string and resolves via the registry.

---

### 2.4 `/repo/app/api/chat/route.ts` — Chat API Route (66 lines)

This is the POST handler that ties everything together.

#### Step-by-Step Flow

1. **Authentication**: `const session = await requireSession()` — enforces authenticated user.

2. **Request Parsing**: Destructures `{ messages, language, model }` from JSON body.

3. **Language Resolution**: 
   ```ts
   const language = lang || (await getTargetLanguage(session.user.id)) || "en";
   ```
   Priority: request param > user preference > fallback "en".

4. **Model Resolution**:
   ```ts
   const userModels = getModelsForUser(session.user.email);
   const modelId = userModels.some(m => m.id === requestedModel) ? requestedModel : DEFAULT_CHAT_MODEL;
   ```
   Validates requested model is in user's allowed list, falls back to `claude-sonnet-4-6`.

5. **Tool Creation**:
   ```ts
   const tools = createTools(session.user.id, language);
   ```
   Creates tools with userId closure.

6. **Parallel Data Fetching** (Promise.all):
   - `getUserPromptTemplate(userId, "chat-system")` — gets user's customized prompt or default
   - Memory row from `userMemory` table
   - Native language from user profile

7. **System Prompt Construction**:
   ```ts
   const systemPrompt = interpolateTemplate(chatTemplate, {
     target_language,
     target_language_code: language,
     native_language,
     memory,
     exercise_syntax: EXERCISE_SYNTAX,
     srs_reference: SRS_REFERENCE,
   });
   ```
   Uses `{variable}` interpolation to inject dynamic values into the template.

8. **Stream Execution**:
   ```ts
   const result = streamText({
     model: getModel(modelId),
     system: systemPrompt,
     messages: await convertToModelMessages(messages),
     tools,                      // <-- tools object passed directly
     stopWhen: stepCountIs(7),   // Max 7 tool-use steps per request
   });
   return result.toUIMessageStreamResponse();
   ```

#### Key Patterns

- **Tools are passed as a plain object** to `streamText()`. The AI SDK handles tool registration, parameter validation, and execution automatically.
- **`stopWhen: stepCountIs(7)`** prevents infinite tool-calling loops.
- **`convertToModelMessages(messages)`** converts UI-format messages to model-format.
- **`toUIMessageStreamResponse()`** returns a streaming response for the frontend.

---

### 2.5 `/repo/lib/prompts/chat-system.ts` — System Prompt Template (46 lines)

#### Structure

```ts
export const CHAT_SYSTEM_PROMPT = {
  id: "chat-system",
  displayName: "Chat Tutor",
  description: "System prompt for the AI language tutor in chat",
  defaultTemplate: `...`,
  variables: ["target_language", "target_language_code", "native_language", "memory", "exercise_syntax", "srs_reference"],
};
```

This is a `PromptDefinition` object. Users can override the template through the UI, but the variables list stays fixed.

#### Template Content

The system prompt tells the AI it is a language tutor and provides:

1. **Memory section**: `<readMemory_result>{memory}</readMemory_result>` — pre-loaded user memory, so the AI doesn't need to call `readMemory` on every conversation start.

2. **Onboarding rules**: 
   - Speak in user's native language
   - If target/native language undefined, ask the user
   - If languages are set but SRS is empty, suggest adding cards

3. **Exercise rules**:
   - Don't output answers when creating exercises in chat
   - Unit creation rules (start with matching-pairs, no translation exercises, etc.)
   - After createUnit succeeds, keep response brief (UI renders a rich card)

4. **Exercise syntax reference**: Full `{exercise_syntax}` block (271 lines of exercise format docs) inside `<exercise-syntax>` tags.

5. **SRS tool guidance**: 
   - Tells AI that `srs` tool uses raw SQL with `$1` bound to user ID
   - Always filter by `user_id = $1 AND language = '{target_language_code}'`
   - Full DDL and SM-2 algorithm reference inside `<srs-reference>` tags

#### How Tools Are Referenced

Tools are referenced **implicitly** — the system prompt describes what the tools do and how to use them, but the actual tool definitions (with their `description` fields) are also sent to the LLM by the AI SDK. The system prompt provides additional context:
- The exercise syntax tells the AI how to format markdown for `presentExercise` and `createUnit`
- The SRS reference tells the AI what SQL to write for the `srs` tool
- Onboarding instructions guide when to use `switchLanguage` and `addWordsToSrs`

---

### 2.6 Supporting Files

#### `/repo/lib/prompts/srs-reference.ts`
Full DDL for `srs_card` table plus SM-2 algorithm rules. Injected into system prompt so the AI can write correct SQL.

#### `/repo/lib/prompts/prompts.ts`
- `langCodeToName` — maps language codes to English names
- `interpolateTemplate(template, vars)` — replaces `{key}` with values
- `PROMPTS_BY_ID` — registry of all prompt definitions
- `PROMPT_DEFINITIONS` — only user-editable prompts (just chat-system)

#### `/repo/lib/content/exercise-syntax.ts`
271-line string constant documenting all exercise types: multiple-choice, translation, fill-in-the-blank, matching-pairs, listening, word-bank, free-text, speaking, flashcard-review. Each with field tables, required/optional markers, and examples.

#### `/repo/components/chat/tool-call.tsx`
Generic collapsible UI for tool calls. Has a `TOOL_LABELS` map that gives human-readable names to each tool. Shows parameters and results in JSON format.

#### `/repo/components/chat/chat-message.tsx`
Routes tool results to specialized renderers:
- `presentExercise` -> `ChatExercise` component (interactive exercise widget)
- `createUnit` -> `ChatUnitCard` component (unit summary card)
- `readArticle` -> `ArticleCard` component (article translation card)
- All others -> generic `ToolCall` component (collapsible JSON view)

---

## 3. Patterns for Adding a New Tool

### Checklist

Here is the exact step-by-step process to add a new tool:

### Step 1: Define the tool in `/repo/lib/ai/tools.ts`

Add a new key to the object returned by `createTools()`:

```ts
myNewTool: tool({
  description: "Clear, concise description for the LLM to understand when to use this tool",
  inputSchema: z.object({
    param1: z.string().describe("Description for the LLM"),
    param2: z.number().optional().describe("Optional param description"),
  }),
  execute: async ({ param1, param2 }) => {
    // userId is available from closure
    // language is available from closure
    try {
      // ... business logic ...
      return { success: true, /* result data */ };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  },
}),
```

**Patterns to follow:**
- Use Zod schemas with `.describe()` on every parameter
- Return plain objects (must be JSON-serializable)
- Handle errors by returning `{ error: ... }` or `{ success: false, error: ... }` — **do not throw**
- Use `userId` from closure for data scoping
- Use `language` from closure as fallback
- Call `revalidatePath()` if the tool modifies data visible in the UI
- For heavy imports, use lazy `await import()` (see `readArticle`)

### Step 2: Add the tool label to `/repo/components/chat/tool-call.tsx`

Add an entry to `TOOL_LABELS`:

```ts
const TOOL_LABELS: Record<string, string> = {
  // ... existing ...
  myNewTool: "Doing something useful",
};
```

### Step 3: (Optional) Add custom frontend rendering in `/repo/components/chat/chat-message.tsx`

If the tool needs a custom UI (like exercises or unit cards), add a condition:

```tsx
if (toolName === "myNewTool") {
  const output = toolPart.output as MyOutputType | undefined;
  if (output?.success) {
    return <MyCustomComponent key={toolPart.toolCallId} {...output} />;
  }
}
```

### Step 4: (Optional) Reference in system prompt

If the tool needs context the AI can't get from the description alone, update the system prompt in `/repo/lib/prompts/chat-system.ts`:
- Add guidance on when/how to use the tool
- If it needs reference data, add a new template variable and inject it through the route

### Step 5: (Optional) Add new template variables

If you added a new variable to the system prompt:
1. Add it to the `variables` array in `CHAT_SYSTEM_PROMPT`
2. Pass it in the `interpolateTemplate()` call in `/repo/app/api/chat/route.ts`

### Step 6: Export (if needed)

The tool is automatically available because `createTools` returns it in the object, and the entire object is passed to `streamText({ tools })`. No additional registration is needed.

---

## 4. Error Handling Patterns

| Pattern | Used By |
|---------|---------|
| Return `{ error: string }` | `srs` tool |
| Return `{ success: false, error: string }` | `presentExercise`, `createUnit`, `switchLanguage` |
| Return `{ success: true, ... }` | All tools on success |
| try/catch with error return | `srs`, `presentExercise`, `createUnit` |
| Input validation with early return | `srs` (regex), `switchLanguage` (supported languages check) |
| Never throw from execute | All tools follow this pattern |

---

## 5. Authentication & Authorization Pattern

- Authentication: `requireSession()` in the route handler — returns 401 if no session
- Authorization (model access): `getModelsForUser(email)` — admins get all models, regular users get restricted list
- Data scoping: `userId` is captured in the `createTools` closure and used in every DB query — the AI **cannot** access other users' data
- SQL injection prevention: The `srs` tool uses regex to restrict table access and binds `userId` as `$1` parameter

---

## 6. Key Design Decisions

1. **Tools return data, not side effects** — The execute functions return structured JSON. The frontend decides how to render it.
2. **Closure-based scoping** — `userId` and `language` are captured once and cannot be manipulated by the AI.
3. **No tool registration boilerplate** — Just add a key to the returned object. The AI SDK handles everything.
4. **System prompt + tool descriptions work together** — Tool descriptions are concise; the system prompt provides detailed context (exercise syntax, SQL DDL).
5. **Step limit** — `stopWhen: stepCountIs(7)` prevents runaway tool loops.
6. **Streaming** — `toUIMessageStreamResponse()` streams tool calls and text to the frontend in real-time.

---

## TODO (for reference — no implementation needed for analysis)

- [x] Read and analyze `/repo/lib/ai/tools.ts` — all 9 tools documented
- [x] Read and analyze `/repo/lib/ai/index.ts` — barrel exports documented
- [x] Read and analyze `/repo/lib/ai/models.ts` — model registry documented
- [x] Read and analyze `/repo/app/api/chat/route.ts` — chat route flow documented
- [x] Read and analyze `/repo/lib/prompts/chat-system.ts` — system prompt documented
- [x] Read and analyze supporting files (srs-reference, exercise-syntax, prompts, tool-call UI, chat-message UI)
- [x] Document all patterns for adding a new tool
- [x] Document error handling patterns
- [x] Document authentication and authorization patterns
