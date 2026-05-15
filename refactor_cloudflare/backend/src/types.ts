import type { drizzle } from "drizzle-orm/postgres-js";
import type { Context } from "hono";
import type postgres from "postgres";
import type { createAuth } from "./lib/auth";
import type * as schema from "./lib/db/schema";

interface MinimalR2Bucket {
  get(key: string): Promise<{
    arrayBuffer(): Promise<ArrayBuffer>;
    httpMetadata?: { contentType?: string };
  } | null>;
  put(key: string, value: BodyInit | null | ArrayBuffer | ArrayBufferView, options?: { httpMetadata?: { contentType?: string } }): Promise<void>;
}

export interface Env {
  BETTER_AUTH_BASE_URL: string;
  BETTER_AUTH_SECRET?: string;
  DATABASE_URL?: string;
  FRONTEND_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  SLACK_WEBHOOK?: string;
  TURNSTILE_SECRET_KEY?: string;
  RESEND_API_KEY?: string;
  RESEND_FROM_EMAIL?: string;
  HYPERDRIVE?: { connectionString: string };
  AUDIO_BUCKET?: MinimalR2Bucket;
}

export type DbClient = postgres.Sql<{}>;
export type Database = ReturnType<typeof drizzle<typeof schema>>;

export interface Variables {
  db: Database;
  sql: DbClient;
  auth: ReturnType<typeof createAuth>;
}

export type AppContext = Context<{ Bindings: Env; Variables: Variables }>;
