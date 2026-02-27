I need a very detailed analysis of the AI tools system in /repo. Please read the following files in their ENTIRETY and provide the full content analysis:

1. `/repo/lib/ai/tools.ts` - Read the ENTIRE file, understand every tool definition, how they're structured, parameters, execute functions, etc.
2. `/repo/lib/ai/index.ts` - Read the full barrel exports
3. `/repo/lib/ai/models.ts` - Read the full model registry
4. `/repo/app/api/chat/route.ts` - Read the ENTIRE chat API route to understand how tools are registered and used
5. `/repo/lib/prompts/chat-system.ts` - Read the system prompt to understand how tools are referenced in the prompt

For each file, provide:
- The complete structure and patterns used
- How tools are defined (parameter schemas, descriptions, execute functions)
- How tools are registered with the AI SDK
- How tools are referenced in the system prompt
- Any patterns for error handling, authentication, etc.

Return ALL of this information in great detail. I need to understand the exact patterns to add a new tool.
