# Task: Custom AI Provider Support

## User Request

The user wants to be able to add a **custom provider** (a custom OpenAI-compatible AI provider) in a simple way. They also want it to be easy to add **available models** without touching much code.

The goal is:
- Configure a custom provider (baseURL + API key + name) via environment variables
- Add models for that provider in a clear and simple way
- Integrate with the existing `createProviderRegistry` system from the Vercel AI SDK using `@ai-sdk/openai-compatible`

## References
- Vercel AI SDK docs on OpenAI-compatible providers: https://ai-sdk.dev/providers/openai-compatible-providers
- Custom providers docs: https://ai-sdk.dev/providers/openai-compatible-providers/custom-providers
