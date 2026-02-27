Analyze all static content and assets in /repo that would be relevant for a frontend-only Vite rewrite:
1. /repo/content/ - all markdown content files, how they're structured and loaded
2. /repo/words/ - all dictionary JSON files, their sizes and structure
3. /repo/public/ - all static assets including manifest.json
4. /repo/lib/content/ - how content is parsed and loaded
5. /repo/lib/languages.ts - language configuration
6. /repo/lib/constants.ts - app constants
7. /repo/lib/srs.ts and /repo/lib/srs-words.ts - SRS algorithm
8. /repo/lib/colors.ts - color utilities

For each piece of content/data, determine:
- Can it be bundled with the frontend?
- Does it need to come from an API?
- How big is it (file sizes)?
- Is there any server-side processing needed?
