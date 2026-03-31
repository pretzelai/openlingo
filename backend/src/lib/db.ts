import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./db/schema";
import type { Env } from "../types";

function getConnectionString(env: Env) {
  return env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL ?? process.env.DATABASE_URL;
}

export function createDb(env: Env) {
  const connectionString = getConnectionString(env);

  if (!connectionString) {
    throw new Error("DATABASE_URL or HYPERDRIVE binding is required");
  }

  const sql = postgres(connectionString, {
    max: 5,
    fetch_types: false,
    prepare: true,
  });

  const db = drizzle(sql, { schema });

  return { db, sql };
}
