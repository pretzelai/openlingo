#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -f "$ROOT_DIR/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT_DIR/.env"
  set +a
fi

DEFAULT_DATABASE_URL="postgresql://lingo:lingo_local_dev@localhost:5432/lingo_refactor"
if command -v docker >/dev/null 2>&1; then
  docker compose -f "$ROOT_DIR/docker-compose.yml" up -d db >/dev/null 2>&1 || true
  DEFAULT_DATABASE_URL="postgresql://lingo:lingo_local_dev@localhost:5438/lingo_refactor"
fi

export DATABASE_URL="${DATABASE_URL:-$DEFAULT_DATABASE_URL}"
export APP_BASE_URL="${APP_BASE_URL:-http://localhost:5173}"
export API_BASE_URL="${API_BASE_URL:-http://localhost:8080}"

cleanup() {
  jobs -p | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT INT TERM

cargo run --manifest-path "$ROOT_DIR/backend/Cargo.toml" &
npm --prefix "$ROOT_DIR/frontend" run dev -- --host 0.0.0.0 --port 5173
