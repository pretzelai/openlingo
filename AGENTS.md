- You have a CLI tool called "agent-browser" that you can use for UI testing
- When you login you can use the credentials testing@openlingo.dev. Password: 0P3NL1NG0
- If login doesn't work signup with email testing-${Date.now()}@openlingo.dev

## Cursor Cloud specific instructions

### Overview

OpenLingo is a Next.js 16 + TypeScript language learning app with PostgreSQL 16 (via Docker), Drizzle ORM, and Bun as the runtime/package manager. See `README.md` for the full tech stack and setup steps.

### Starting services

1. **Docker daemon**: Must be running first. Start with `sudo dockerd &` if not already up. The VM uses `fuse-overlayfs` storage driver and `iptables-legacy` for Docker-in-Docker compatibility.
2. **PostgreSQL**: `docker compose up -d` (exposes port 5437). Ensure Docker socket is accessible (`sudo chmod 666 /var/run/docker.sock` if needed).
3. **Database migrations**: `bun run db:migrate` (idempotent, safe to re-run).
4. **Database seed**: `bun run db:seed` (idempotent, skips already-seeded data).
5. **Dev server**: `bun run dev` (Next.js on port 3000).

### Environment

- Copy `example.env.local` to `.env.local` if it doesn't exist. The defaults work for local dev (DB URL, auth secret, Turnstile test keys).
- The example env includes Cloudflare Turnstile **test keys** that auto-pass verification. Do not remove them or sign-up/sign-in will still work but the CAPTCHA widget won't render properly.
- AI features (chat, TTS, STT, article translation) require at least one LLM provider API key (`OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, or `GOOGLE_AI_API_KEY`). The app runs without them but those features won't function.

### Key commands

| Task | Command |
|------|---------|
| Install deps | `bun install` |
| Lint | `bun run lint` (ESLint; has pre-existing warnings) |
| Build | `bun run build` |
| Dev server | `bun run dev` |
| DB up | `bun run db:up` (`docker compose up -d`) |
| DB migrate | `bun run db:migrate` |
| DB seed | `bun run db:seed` |
| DB reset | `bun run db:reset` (nukes + re-seeds) |

### Gotchas

- The `bun` binary lives at `~/.bun/bin/bun`. Ensure `PATH` includes `$HOME/.bun/bin`.
- Docker requires `fuse-overlayfs` storage driver and `iptables-legacy` in the Cloud Agent VM (Docker-in-Docker in Firecracker). If Docker fails to start, check `/etc/docker/daemon.json` has `{"storage-driver": "fuse-overlayfs"}` and run `sudo update-alternatives --set iptables /usr/sbin/iptables-legacy`.
- PostgreSQL runs on port **5437** (not the default 5432) to avoid conflicts.
- No automated test suite exists in the repo (no `test` script in `package.json`). Lint (`bun run lint`) and build (`bun run build`) are the main CI checks.