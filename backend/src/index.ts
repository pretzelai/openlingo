import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { createDb } from "./lib/db";
import { createAuth } from "./lib/auth";
import type { Env, Variables } from "./types";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

app.use("*", async (c, next) => {
  const { db, sql } = createDb(c.env);
  c.set("db", db);
  c.set("sql", sql);
  c.set("auth", createAuth(c.env));
  await next();
});

app.on(["GET", "POST"], "/api/auth/*", (c) => {
  return c.get("auth").handler(c.req.raw);
});

app.get("/health", () => Response.json({ ok: true }));

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  console.error(error);
  return Response.json({ error: "Internal server error" }, { status: 500 });
});

export default app;
