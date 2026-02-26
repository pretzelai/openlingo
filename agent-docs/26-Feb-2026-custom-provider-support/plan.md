# Plan: Custom AI Provider Support

## Codebase Research

### Current Model / Provider Architecture

**`lib/ai/models.ts`** — Core of the provider system:
- Creates three static providers: `google`, `openai`, `anthropic`
- Registers them with `createProviderRegistry({ google, openai, anthropic })`
- Exports `AVAILABLE_MODELS[]` — a hardcoded list of models with `{ id, label, provider }`
- `CHAT_AVAILABLE_MODELS` — a filtered subset for non-admin users
- `getModel(id)` resolves `provider:modelId` from the registry
- `getModelsForUser(email)` — admins see all models, regular users only see `CHAT_AVAILABLE_MODELS`

**`lib/constants.ts`**:
- `DEFAULT_AI_MODEL = "claude-sonnet-4-6"` — hardcoded default model

**`lib/actions/preferences.ts`**:
- `updatePreferredModel(model)` — validates the model is in the user's allowed list
- `getPreferredModel(userId)` — reads from DB, falls back to `DEFAULT_AI_MODEL`

**`app/api/chat/route.ts`**:
- Calls `getModelsForUser(email)` + `getModel(modelId)` from the AI SDK

**`components/chat/chat-view.tsx`**:
- Renders the model `<select>` using the `availableModels` prop (already dynamic)

**`app/(main)/settings/settings-view.tsx`**:
- User settings panel (no model section currently)

---

### Problem to Solve

The system is currently **fully static**: providers and models are hardcoded in `models.ts`. Adding a new provider requires:
1. Installing the SDK package
2. Modifying `models.ts` to import and configure the new provider
3. Manually adding models to `AVAILABLE_MODELS`

The goal is to allow connecting any **OpenAI-compatible API** (Ollama, LM Studio, Together.ai, Groq, OpenRouter, etc.) using only environment variables — no code changes required.

---

### Available Technology

The Vercel AI SDK already ships `@ai-sdk/openai-compatible`, which allows creating providers like this:

```ts
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const myProvider = createOpenAICompatible({
  name: 'my-provider',
  apiKey: process.env.MY_PROVIDER_API_KEY,
  baseURL: 'https://api.my-provider.com/v1',
});
```

This provider can be registered directly in `createProviderRegistry`, just like the existing ones.

---

## Solution Design

### Strategy: Custom Provider via ENV + Models via ENV

We will add support for **one custom provider** that is fully configured through environment variables:

```env
# Custom provider settings
CUSTOM_PROVIDER_NAME=ollama          # Internal name in the registry
CUSTOM_PROVIDER_BASE_URL=http://localhost:11434/v1
CUSTOM_PROVIDER_API_KEY=             # Empty if no auth required (e.g. local Ollama)

# Models for the custom provider (JSON array)
CUSTOM_PROVIDER_MODELS=[{"id":"llama3.2","label":"Llama 3.2","chat":true},{"id":"qwen2.5","label":"Qwen 2.5","chat":true}]
```

If not configured (`CUSTOM_PROVIDER_BASE_URL` is empty), the custom provider simply does not appear. This maintains full backward compatibility.

### `chat` field on models

Each custom provider model has an optional `chat: boolean` field. If `true`, the model appears in `CHAT_AVAILABLE_MODELS` (visible to regular users). If `false` or omitted, it only appears for admins. This gives deployers fine-grained control.

### Change Breakdown

#### 1. Install dependency

```bash
bun add @ai-sdk/openai-compatible
```

#### 2. Modify `lib/ai/models.ts`

- Import `createOpenAICompatible` from `@ai-sdk/openai-compatible`
- Read custom provider env vars
- If `CUSTOM_PROVIDER_BASE_URL` is defined:
  - Parse `CUSTOM_PROVIDER_MODELS` with try/catch (fallback to `[]` on invalid JSON)
  - Create the provider with `createOpenAICompatible`
  - Register it conditionally in `createProviderRegistry`
  - Extend `AVAILABLE_MODELS` with the parsed custom models
- `CHAT_AVAILABLE_MODELS` filters to include custom models with `chat: true`

```ts
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';

const CUSTOM_PROVIDER_NAME = process.env.CUSTOM_PROVIDER_NAME || "custom";
const CUSTOM_BASE_URL = process.env.CUSTOM_PROVIDER_BASE_URL;
const CUSTOM_API_KEY = process.env.CUSTOM_PROVIDER_API_KEY || "";

type CustomModelDef = { id: string; label: string; chat?: boolean };

let customModels: CustomModelDef[] = [];
let customProvider: ReturnType<typeof createOpenAICompatible> | undefined;

if (CUSTOM_BASE_URL) {
  try {
    customModels = JSON.parse(process.env.CUSTOM_PROVIDER_MODELS || "[]");
  } catch {
    customModels = [];
  }
  customProvider = createOpenAICompatible({
    name: CUSTOM_PROVIDER_NAME,
    apiKey: CUSTOM_API_KEY,
    baseURL: CUSTOM_BASE_URL,
  });
}

const providers = {
  google,
  openai,
  anthropic,
  ...(customProvider ? { [CUSTOM_PROVIDER_NAME]: customProvider } : {}),
};
const registry = createProviderRegistry(providers);

export const AVAILABLE_MODELS = [
  ...staticModels,
  ...customModels.map((m) => ({
    id: m.id,
    label: m.label,
    provider: CUSTOM_PROVIDER_NAME,
  })),
];

export const CHAT_AVAILABLE_MODELS = AVAILABLE_MODELS.filter(
  (m) =>
    m.id === "claude-sonnet-4-6" ||
    customModels.some((cm) => cm.id === m.id && cm.chat === true),
);
```

#### 3. Update `example.env.local`

Add the new variables (commented out with examples):

```env
# Custom OpenAI-compatible provider (optional)
# CUSTOM_PROVIDER_NAME=ollama
# CUSTOM_PROVIDER_BASE_URL=http://localhost:11434/v1
# CUSTOM_PROVIDER_API_KEY=
# CUSTOM_PROVIDER_MODELS=[{"id":"llama3.2","label":"Llama 3.2","chat":true}]
```

#### 4. Update `README.md`

Add a *Custom Provider* section explaining how to configure it, with examples for Ollama, LM Studio, OpenRouter, and Together.ai.

---

## Design Decisions

1. **Single custom provider**: Simplifies setup considerably. For most self-hosted cases (local Ollama, a proxy like OpenRouter), one custom provider is sufficient. The pattern can be extended later if needed.

2. **Config via ENV only**: No UI changes, no DB migrations, no auth system changes. Self-hosted deployments can configure their providers at the same level as API keys.

3. **Customizable provider name**: `CUSTOM_PROVIDER_NAME` allows the provider to appear with a descriptive name in logs and in the registry. Defaults to `"custom"` if not set.

4. **Models as JSON**: Flexible — allows adding N models with their own metadata without changing code.

5. **`chat` field for visibility control**: Maintains the existing admin/non-admin pattern, now applied to custom models.

6. **`getModel(id)` unchanged**: The function already looks up the provider from `AVAILABLE_MODELS` and builds `provider:id`. Since the custom provider is registered under its name, this works automatically.

7. **Full backward compatibility**: If no env vars are configured, behavior is identical to the current implementation.

---

## Edge Cases

- **Malformed `CUSTOM_PROVIDER_MODELS` JSON**: Caught with try/catch → falls back to empty array, app does not crash.
- **Empty `CUSTOM_PROVIDER_API_KEY`**: Some local providers (e.g. Ollama) don't require an API key. The SDK will send `Authorization: Bearer ` (empty), which Ollama ignores.
- **Custom model selected, then custom provider disabled**: `getModel(id)` won't find the provider in the registry and will throw. The fallback to `DEFAULT_CHAT_MODEL` in `/api/chat/route.ts` prevents a crash.
- **Provider name with special characters**: The AI SDK registry requires valid identifiers. Document that the name should be alphanumeric/hyphenated.

---

## Todo List

- [ ] 1. Install `@ai-sdk/openai-compatible` with bun
- [ ] 2. Modify `lib/ai/models.ts`:
  - Import `createOpenAICompatible`
  - Read `CUSTOM_PROVIDER_NAME`, `CUSTOM_PROVIDER_BASE_URL`, `CUSTOM_PROVIDER_API_KEY`, `CUSTOM_PROVIDER_MODELS` from env
  - Parse custom models with try/catch
  - Create custom provider if `CUSTOM_BASE_URL` is defined
  - Conditionally register it in `createProviderRegistry`
  - Extend `AVAILABLE_MODELS` with custom models
  - Update `CHAT_AVAILABLE_MODELS` to include custom models with `chat: true`
- [ ] 3. Update `example.env.local` with new variables (commented out)
- [ ] 4. Update `README.md` with a Custom Provider section and usage examples
