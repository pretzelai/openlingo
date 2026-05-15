# OpenLingo Refactor

This folder contains the end-to-end rewrite target: a Vite React frontend and a Rust/Axum monolith backend.

The original Next.js app remains untouched at the repository root while this implementation is developed and tested on a separate domain.

## Layout

```text
refactor_rust/
  backend/   Rust Axum monolith, SQLx/Postgres, background jobs
  frontend/  Vite React app
```

## Local development

1. Copy env:

```bash
cp refactor_rust/.env.example refactor_rust/.env
```

2. Start Postgres using either the root `docker-compose.yml` or this folder's compose file.
3. Run both servers:

```bash
bash refactor_rust/dev.sh
```

Frontend: http://localhost:5173

Backend API: http://localhost:8080/api/health

## Production

Build the frontend, then run the Rust server. The backend serves `/api/*` plus the built Vite assets from `frontend/dist`.
