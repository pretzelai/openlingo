import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { createDb } from "./lib/db";
import { createAuth } from "./lib/auth";
import type { AppContext, Env, Variables } from "./types";
import { getGitHubStars } from "./lib/github";
import { jsonError, requireParam, safeJson } from "./lib/http";
import { getStandaloneUnits } from "./services/courses";
import { listCoursesWithLessonCounts } from "./services/courses";
import { submitFeedback } from "./services/feedback";
import { completeLesson } from "./services/lessons";
import { getMemory, getPrompts, resetPrompt, saveMemory, savePrompt } from "./services/prompts";
import { getNativeLanguage, getProfileData, updateNativeLanguage } from "./services/profile";
import { getUnitProgress, getUserProgress, getUserStatsData } from "./services/progress";
import { getPreferredModel, getTargetLanguage, updatePreferredModel, updateTargetLanguage } from "./services/preferences";
import { addWordToSrs, getAllCards, getSrsStats, removeWordFromSrs, reviewCard } from "./services/srs";
import { lookupWord } from "./services/words";
import type { Quality } from "../../../lib/srs";

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

function hasDatabase(env: Env) {
  return Boolean(env.HYPERDRIVE?.connectionString || env.DATABASE_URL || process.env.DATABASE_URL);
}

async function attachRuntime(c: AppContext) {
  const { db, sql } = createDb(c.env);
  c.set("db", db);
  c.set("sql", sql);
  c.set("auth", createAuth(c.env));
}

async function requireApiSession(c: AppContext) {
  if (!hasDatabase(c.env) || !c.env.BETTER_AUTH_SECRET) {
    throw new HTTPException(503, { message: "Auth requires BETTER_AUTH_SECRET and DATABASE_URL/HYPERDRIVE" });
  }

  await attachRuntime(c);
  const session = await c.get("auth").api.getSession({ headers: c.req.raw.headers });
  if (!session?.user?.id) {
    throw new HTTPException(401, { message: "Unauthorized" });
  }

  return session;
}

app.use("*", async (c, next) => {
  const origin = c.req.header("Origin");
  const allowedOrigin = c.env.FRONTEND_URL ?? "http://localhost:5173";

  if (origin === allowedOrigin || origin?.startsWith("http://localhost:")) {
    c.header("Access-Control-Allow-Origin", origin);
    c.header("Access-Control-Allow-Credentials", "true");
    c.header("Vary", "Origin");
  }
  c.header("Access-Control-Allow-Headers", "Content-Type, Authorization, x-turnstile-token");
  c.header("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, OPTIONS");

  if (c.req.method === "OPTIONS") {
    return new Response(null, { status: 204 });
  }

  await next();
});

app.on(["GET", "POST"], "/api/auth/*", async (c) => {
  if (!hasDatabase(c.env) || !c.env.BETTER_AUTH_SECRET) {
    return jsonError("Auth requires BETTER_AUTH_SECRET and DATABASE_URL/HYPERDRIVE", 503);
  }
  await attachRuntime(c);
  return c.get("auth").handler(c.req.raw);
});

app.get("/health", () => Response.json({ ok: true }));

app.get("/api/session", async (c) => {
  if (!hasDatabase(c.env) || !c.env.BETTER_AUTH_SECRET) {
    return Response.json({ session: null });
  }

  await attachRuntime(c);
  const session = await c.get("auth").api.getSession({ headers: c.req.raw.headers });
  return Response.json({ session });
});

app.get("/api/github/stars", async () => {
  const stars = await getGitHubStars();
  return Response.json({ stars });
});

app.get("/api/courses", async (c) => {
  await attachRuntime(c);
  const session = await c.get("auth").api.getSession({ headers: c.req.raw.headers }).catch(() => null);
  const courses = await listCoursesWithLessonCounts(c.get("db"), {
    sourceLanguage: c.req.query("sourceLanguage"),
    targetLanguage: c.req.query("targetLanguage"),
    level: c.req.query("level"),
  }, session?.user?.id);

  return Response.json({ courses });
});

app.get("/api/units", async (c) => {
  await attachRuntime(c);
  const session = await c.get("auth").api.getSession({ headers: c.req.raw.headers }).catch(() => null);
  if (!session?.user?.id) return Response.json({ units: [] });

  const units = await getStandaloneUnits(c.get("db"), session.user.id);
  return Response.json({ units });
});

app.get("/api/word/lookup", async (c) => {
  await attachRuntime(c);
  const word = requireParam(c.req.query("word"), "word query parameter is required");
  const language = c.req.query("language") ?? "de";
  const result = await lookupWord(c.get("db"), word, language);
  return Response.json(result);
});

app.post("/api/feedback", async (c) => {
  await attachRuntime(c);
  const session = await c.get("auth").api.getSession({ headers: c.req.raw.headers }).catch(() => null);
  const body = await safeJson<{ message: string; email?: string; turnstileToken?: string }>(c.req.raw);
  const result = await submitFeedback(c.get("db"), session, { ...body, slackWebhook: c.env.SLACK_WEBHOOK });
  return Response.json(result, { status: result.success ? 200 : 400 });
});

app.get("/api/profile", async (c) => {
  const session = await requireApiSession(c);
  const profile = await getProfileData(c.get("db"), session.user.id, {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
  });
  return Response.json(profile);
});

app.get("/api/preferences", async (c) => {
  const session = await requireApiSession(c);
  const [nativeLanguage, targetLanguage, preferredModel] = await Promise.all([
    getNativeLanguage(c.get("db"), session.user.id),
    getTargetLanguage(c.get("db"), session.user.id),
    getPreferredModel(c.get("db"), session.user.id),
  ]);

  return Response.json({ nativeLanguage, targetLanguage, preferredModel });
});

app.patch("/api/preferences", async (c) => {
  const session = await requireApiSession(c);
  const body = await safeJson<{ nativeLanguage?: string; targetLanguage?: string; preferredModel?: string }>(c.req.raw);
  const updates: Promise<void>[] = [];
  if (body.nativeLanguage) updates.push(updateNativeLanguage(c.get("db"), session.user.id, body.nativeLanguage));
  if (body.targetLanguage) updates.push(updateTargetLanguage(c.get("db"), session.user.id, body.targetLanguage));
  if (body.preferredModel) updates.push(updatePreferredModel(c.get("db"), session.user.id, session.user.email, body.preferredModel));
  await Promise.all(updates);
  return Response.json({ success: true });
});

app.get("/api/prompts", async (c) => {
  const session = await requireApiSession(c);
  const prompts = await getPrompts(c.get("db"), session.user.id);
  return Response.json({ prompts });
});

app.put("/api/prompts/:id", async (c) => {
  const session = await requireApiSession(c);
  const body = await safeJson<{ value: string }>(c.req.raw);
  await savePrompt(c.get("db"), session.user.id, c.req.param("id"), body.value);
  return Response.json({ success: true });
});

app.delete("/api/prompts/:id", async (c) => {
  const session = await requireApiSession(c);
  await resetPrompt(c.get("db"), session.user.id, c.req.param("id"));
  return Response.json({ success: true });
});

app.get("/api/memory", async (c) => {
  const session = await requireApiSession(c);
  const value = await getMemory(c.get("db"), session.user.id);
  return Response.json({ value });
});

app.put("/api/memory", async (c) => {
  const session = await requireApiSession(c);
  const body = await safeJson<{ value: string }>(c.req.raw);
  await saveMemory(c.get("db"), session.user.id, body.value ?? "");
  return Response.json({ success: true });
});

app.get("/api/progress/stats", async (c) => {
  const session = await requireApiSession(c);
  const stats = await getUserStatsData(c.get("db"), session.user.id);
  return Response.json({ stats });
});

app.get("/api/progress/course/:courseId", async (c) => {
  const session = await requireApiSession(c);
  const progress = await getUserProgress(c.get("db"), session.user.id, c.req.param("courseId"));
  return Response.json(progress);
});

app.get("/api/progress/unit/:unitId", async (c) => {
  const session = await requireApiSession(c);
  const progress = await getUnitProgress(c.get("db"), session.user.id, c.req.param("unitId"));
  return Response.json(progress);
});

app.post("/api/lessons/complete", async (c) => {
  const session = await requireApiSession(c);
  const body = await safeJson<Parameters<typeof completeLesson>[2]>(c.req.raw);
  const result = await completeLesson(c.get("db"), session.user.id, body);
  return Response.json(result);
});

app.get("/api/srs/cards", async (c) => {
  const session = await requireApiSession(c);
  const cards = await getAllCards(c.get("db"), session.user.id, c.req.query("language"));
  return Response.json({ cards });
});

app.get("/api/srs/stats", async (c) => {
  const session = await requireApiSession(c);
  const stats = await getSrsStats(c.get("db"), session.user.id, c.req.query("language"));
  return Response.json({ stats });
});

app.post("/api/srs/cards", async (c) => {
  const session = await requireApiSession(c);
  const body = await safeJson<{ word: string; language: string; translation?: string }>(c.req.raw);
  await addWordToSrs(c.get("db"), session.user.id, body.word, body.language, body.translation ?? "");
  return Response.json({ success: true });
});

app.post("/api/srs/review", async (c) => {
  const session = await requireApiSession(c);
  const body = await safeJson<{ word: string; language: string; quality: Quality }>(c.req.raw);
  const result = await reviewCard(c.get("db"), session.user.id, body.word, body.language, body.quality);
  return Response.json(result);
});

app.delete("/api/srs/cards", async (c) => {
  const session = await requireApiSession(c);
  const body = await safeJson<{ word: string; language: string }>(c.req.raw);
  await removeWordFromSrs(c.get("db"), session.user.id, body.word, body.language);
  return Response.json({ success: true });
});

app.onError((error, c) => {
  if (error instanceof HTTPException) {
    return Response.json({ error: error.message }, { status: error.status });
  }

  console.error(error);
  return Response.json({ error: "Internal server error" }, { status: 500 });
});

export default app;
