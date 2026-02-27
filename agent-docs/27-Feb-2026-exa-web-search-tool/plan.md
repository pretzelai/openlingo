# Plan: Add Exa Web Search Tool to Chat

## Research Summary

### Current Architecture
- **Tools system**: `lib/ai/tools.ts` exports `createTools(userId, language)` returning a plain object of tool definitions using Vercel AI SDK's `tool()` helper with Zod schemas.
- **Chat API**: `app/api/chat/route.ts` passes all tools to `streamText()` — no registration step needed beyond adding a key to the tools object.
- **UI rendering**: `components/chat/chat-message.tsx` routes tool parts to custom cards (for `presentExercise`, `createUnit`, `readArticle`) or falls back to the generic collapsible `ToolCall` component.
- **Tool labels**: `components/chat/tool-call.tsx` has a `TOOL_LABELS` map for display names.
- **Env keys**: `example.env.local` lists API keys pattern (e.g. `OPENAI_API_KEY=sk-proj-`).

### Exa API
- **Endpoint**: `POST https://api.exa.ai/search`
- **Auth**: `x-api-key` header
- **Key parameters**: `query`, `type` (auto/neural/fast), `numResults`, `category` (news, research paper, etc.), `contents` (text, highlights, summary), `includeDomains`, `startPublishedDate`
- **Response**: `{ results: [{ title, url, publishedDate, author, text?, highlights?, summary? }] }`
- No npm SDK is needed — a simple `fetch()` call to the REST API is sufficient and avoids adding a dependency.

### Design Decisions

1. **Direct `fetch()` vs. `exa-js` SDK**: Use direct `fetch()`. The API is a single endpoint with straightforward JSON. No need for an extra dependency.

2. **Tool purpose**: The tool is primarily for **finding articles to translate**. The AI tutor can search the web for relevant articles in the user's target language or about topics the user is interested in, then use the existing `readArticle` tool to translate them. It can also be used for general information lookup during conversations.

3. **Search results content**: Request `highlights` and `summary` from Exa so the AI gets enough context to decide which articles are relevant, without fetching full text (which would be too large for the context window). The existing `readArticle` tool handles full article fetching/translation.

4. **Custom UI card**: Create a `SearchResultsCard` component that displays search results in a visually appealing way — showing titles, URLs, summaries, and published dates. The user can click results to open them or the AI can pipe URLs into `readArticle`.

5. **Parameters exposed to AI**: `query` (required), `numResults` (optional, default 5), `category` (optional), `startPublishedDate` (optional — useful for "recent news" queries). Keep it simple and let the AI construct good queries.

6. **Error handling**: Follow existing pattern — never throw, return `{ error: "..." }` on failure. If `EXA_API_KEY` is not set, return a clear error message.

7. **System prompt guidance**: Add a brief mention in the system prompt so the AI knows it can search the web and then use `readArticle` to translate results.

### Edge Cases & Considerations
- **Missing API key**: Tool should gracefully return an error if `EXA_API_KEY` is not set, not crash.
- **Rate limiting**: Exa may rate-limit. The tool should handle non-200 responses gracefully.
- **Result count**: Cap at 10 results to avoid bloating the context.
- **Language awareness**: The AI should be guided to search in the target language or for content about the target language when looking for articles to translate.

## Files to Modify/Create

| File | Action | Description |
|---|---|---|
| `lib/ai/tools.ts` | Modify | Add `webSearch` tool definition |
| `components/chat/tool-call.tsx` | Modify | Add `webSearch` to `TOOL_LABELS` |
| `components/chat/chat-message.tsx` | Modify | Add custom rendering for `webSearch` results |
| `components/chat/search-results-card.tsx` | Create | New component for rendering search results |
| `lib/prompts/chat-system.ts` | Modify | Add guidance about web search + readArticle workflow |
| `example.env.local` | Modify | Add `EXA_API_KEY=` entry |

## Implementation Steps

- [ ] 1. Add `EXA_API_KEY` to `example.env.local`
- [ ] 2. Add `webSearch` tool to `lib/ai/tools.ts` with Exa API integration
- [ ] 3. Add `webSearch` to `TOOL_LABELS` in `components/chat/tool-call.tsx`
- [ ] 4. Create `components/chat/search-results-card.tsx` with custom UI for search results
- [ ] 5. Add custom rendering for `webSearch` in `components/chat/chat-message.tsx`
- [ ] 6. Add system prompt guidance about web search in `lib/prompts/chat-system.ts`
