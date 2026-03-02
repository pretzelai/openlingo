# Plan: Route Anthropic through liteLLM proxy

## Research findings

- The Anthropic provider is created in `lib/ai/models.ts:14-16` using `createAnthropic()` from `@ai-sdk/anthropic`.
- Currently only `apiKey` is passed (from `ANTHROPIC_API_KEY`). No `baseURL` is set.
- The SDK supports a `baseURL` option in `createAnthropic()`.
- Environment variables are defined in `.env.local` and `example.env.local`.

## Design decisions

- Replace `ANTHROPIC_API_KEY` with `LLM_PROXY_API_KEY` in the `createAnthropic()` call.
- Add `baseURL: process.env.LLM_PROXY_URL` to the `createAnthropic()` call.
- Update `.env.local` to add `LLM_PROXY_URL` and `LLM_PROXY_API_KEY` (replacing the old `ANTHROPIC_API_KEY` line).
- Update `example.env.local` with the new env var placeholders.
- Keep `ANTHROPIC_API_KEY` in `.env.local` commented out for reference.

## Edge cases

- If `LLM_PROXY_URL` is not set, the SDK will fall back to the default Anthropic URL (`https://api.anthropic.com/v1`), which is reasonable behaviour.
- The liteLLM proxy must accept the same request format as the Anthropic API for this to work transparently.

## Todo

1. Update `lib/ai/models.ts` — add `baseURL` and change API key env var in `createAnthropic()`.
2. Update `.env.local` — add `LLM_PROXY_URL` and `LLM_PROXY_API_KEY`.
3. Update `example.env.local` — add placeholder entries for the new env vars.
