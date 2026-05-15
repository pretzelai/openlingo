# OpenLingo Cloudflare refactor

This folder contains the Vite + Cloudflare Workers migration preview, isolated from the current Next.js app.

## Layout

- `vite/` — React/Vite frontend intended for Cloudflare Pages or another static host.
- `backend/` — Hono + Cloudflare Workers API replacing Next route handlers/server actions.

## Local preview

```bash
npm run dev
```

Frontend: <http://localhost:5173>  
Backend: <http://localhost:8787>

The Vite dev server proxies `/api/*` to the Worker during local development.

## Build checks

```bash
npm run build
```

## Deploying to a test subdomain

Suggested Cloudflare setup:

1. Deploy `backend/` as a Worker, for example `openlingo-refactor-cloudflare-api`.
2. Deploy `vite/dist` as a Cloudflare Pages project, for example `openlingo-refactor-cloudflare`.
3. Add a Pages custom domain such as `refactor.openlingo.dev`.
4. Add a Worker route/custom domain for the API, or keep API requests proxied under the same domain.
5. Set production env/secrets before testing auth and database-backed features:
   - `DATABASE_URL` or a `HYPERDRIVE` binding
   - `BETTER_AUTH_SECRET`
   - `BETTER_AUTH_BASE_URL`
   - `FRONTEND_URL`
   - provider keys such as Google, OpenAI/Gemini/Anthropic, Resend, Slack, Turnstile, R2 bindings as needed

Convenience deploy scripts are included:

```bash
npm run deploy:backend
npm run deploy:frontend
```

Update `backend/wrangler.jsonc` with real Cloudflare bindings/routes before production-like testing.
