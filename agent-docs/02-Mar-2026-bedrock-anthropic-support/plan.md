# Plan: Add Anthropic Models via Amazon Bedrock Support

## Research Summary

### Current Architecture

The AI model system lives in `lib/ai/models.ts` and works as follows:

1. **Three provider instances** are created at module scope: `google`, `openai`, `anthropic` — each initialized with their respective API keys from environment variables.
2. These are combined into a **unified provider registry** via `createProviderRegistry({ google, openai, anthropic })`.
3. An `AVAILABLE_MODELS` array lists 7 models, each with `{ id, label, provider }`. The `provider` field maps to the key used in the registry (e.g., `"anthropic"`, `"google"`, `"openai"`).
4. `getModel(id)` resolves a model to `"provider:id"` format and calls `registry.languageModel()`.
5. `getModelsForUser(email)` gates access: admins see all 7 models, non-admins see only `claude-sonnet-4-6`.
6. The chat UI (`components/chat/chat-view.tsx`) renders a `<select>` dropdown populated from `availableModels`.
7. The chat API (`app/api/chat/route.ts`) validates the requested model against the user's allowed list, then calls `getModel(modelId)`.
8. User model preference is persisted in the `userPreferences.preferredModel` column (nullable text).
9. The `scripts/generate-unit.ts` CLI script also uses `getModel()` with a provider-to-model mapping.

### Key Files to Modify

| File | Change |
|------|--------|
| `lib/ai/models.ts` | Add Bedrock provider instance, register it, add Bedrock models to `AVAILABLE_MODELS` |
| `example.env.local` | Add `AWS_BEDROCK_URL` and `AWS_BEDROCK_API_KEY` env var templates |
| `package.json` | Add `@ai-sdk/amazon-bedrock` dependency |
| `scripts/generate-unit.ts` | Add `bedrock` as a valid provider option |

### Key Files That Need NO Changes

| File | Reason |
|------|--------|
| `app/api/chat/route.ts` | Already dynamically resolves models via `getModel()` — works automatically |
| `components/chat/chat-view.tsx` | Already renders from `availableModels` prop — works automatically |
| `lib/actions/preferences.ts` | Already validates against `getModelsForUser()` — works automatically |
| `lib/ai/index.ts` | Barrel re-exports — no new exports needed |
| `lib/constants.ts` | Default model stays `claude-sonnet-4-6` (direct Anthropic) |
| `lib/db/schema.ts` | `preferredModel` is already free-form `text` — no migration needed |

## Design Decisions

### 1. Provider naming: `bedrock`

The Bedrock provider will be registered under the key `"bedrock"` in the provider registry. This means Bedrock model IDs in `AVAILABLE_MODELS` will use `provider: "bedrock"`, and `getModel()` will resolve them as `"bedrock:us.anthropic.claude-sonnet-4-20250514-v1:0"` etc.

### 2. Authentication: API key + custom base URL

The user has stated they will provide a URL and API key via environment variables. The `@ai-sdk/amazon-bedrock` provider supports:
- `baseURL` — custom endpoint URL (for proxy or custom Bedrock endpoints)
- `apiKey` — Bearer token authentication (simpler than AWS SigV4)

We will use two environment variables:
- `AWS_BEDROCK_URL` — the base URL for the Bedrock endpoint
- `AWS_BEDROCK_API_KEY` — the API key / bearer token

The provider will only be instantiated and registered if at least `AWS_BEDROCK_API_KEY` is set, to avoid breaking existing setups that don't use Bedrock.

### 3. Bedrock model IDs

Amazon Bedrock uses its own model ID format for Anthropic models. The standard Bedrock model IDs for Anthropic Claude are:
- `us.anthropic.claude-sonnet-4-20250514-v1:0` (Claude Sonnet 4)
- `us.anthropic.claude-opus-4-20250514-v1:0` (Claude Opus 4)

We will add these two models with clear labels like "Claude Sonnet 4 (Bedrock)" and "Claude Opus 4 (Bedrock)" to distinguish them from the direct Anthropic API equivalents.

### 4. Model visibility

The Bedrock models will be added to `AVAILABLE_MODELS` only (admin-visible). Regular users will continue to see only `claude-sonnet-4-6` via direct Anthropic. Admins who want to test Bedrock routing can select the Bedrock variants from the chat dropdown.

### 5. Conditional registration

If `AWS_BEDROCK_API_KEY` is not set, the Bedrock provider and its models will simply not be registered/listed. This ensures zero impact on existing deployments that don't use Bedrock.

## Edge Cases & Things to Watch

1. **Registry typing**: `createProviderRegistry` expects specific provider keys. Adding `bedrock` conditionally means we need to conditionally spread it into the registry config object.
2. **`getModel()` resolution**: The function looks up the model in `AVAILABLE_MODELS` to find its `provider`, then constructs `"provider:id"`. If Bedrock models are conditionally added, `getModel()` will simply not find them when Bedrock is disabled — and the caller should already be validating against `AVAILABLE_MODELS`.
3. **`generate-unit.ts` script**: Currently maps `"anthropic"` to a model ID. We should add `"bedrock"` as an option that maps to the Bedrock Sonnet model ID.
4. **No DB migration needed**: The `preferredModel` column is free-form text — any new model ID string can be stored.
5. **Model ID format**: Bedrock model IDs contain dots and colons (e.g., `us.anthropic.claude-sonnet-4-20250514-v1:0`). We must ensure these don't conflict with the `provider:id` resolution format in `getModel()`. Since the registry already handles `bedrock:us.anthropic.claude-sonnet-4-20250514-v1:0` correctly (the first colon separates provider from model ID in the Vercel AI SDK), this should work.

## Implementation Steps

- [ ] 1. Install `@ai-sdk/amazon-bedrock` package via bun
- [ ] 2. Update `lib/ai/models.ts`:
  - Import `createAmazonBedrock` from `@ai-sdk/amazon-bedrock`
  - Conditionally create the bedrock provider instance (only if `AWS_BEDROCK_API_KEY` is set)
  - Add bedrock to the provider registry (conditionally)
  - Add Bedrock Anthropic models to `AVAILABLE_MODELS` (conditionally)
- [ ] 3. Update `example.env.local` with `AWS_BEDROCK_URL` and `AWS_BEDROCK_API_KEY` templates
- [ ] 4. Update `scripts/generate-unit.ts` to support `--provider bedrock`
- [ ] 5. Verify the build succeeds with `bun run build`
