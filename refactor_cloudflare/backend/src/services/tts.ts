import { createHash } from "node:crypto";
import OpenAI from "openai";
import { and, eq } from "drizzle-orm";
import type { Database, Env } from "../types";
import { audioCache } from "../lib/db/schema";
import { getPublicUrl, uploadAudio } from "../lib/r2";
import {
  getDefaultTemplate,
  interpolateTemplate,
  langCodeToName,
} from "../../../../lib/prompts";

const openai = new OpenAI();

export async function generateSpeech(
  db: Database,
  env: Env,
  text: string,
  language: string,
): Promise<string> {
  const normalized = text.toLowerCase();

  const cached = await db
    .select()
    .from(audioCache)
    .where(and(eq(audioCache.text, normalized), eq(audioCache.language, language)))
    .limit(1);

  if (cached.length > 0) {
    return getPublicUrl(cached[0].r2Key);
  }

  const targetLanguage = langCodeToName[language] || "the target language";
  const template = getDefaultTemplate("tts-instructions");
  const instructions = interpolateTemplate(template, { target_language: targetLanguage });

  const response = await openai.audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice: "coral",
    input: text,
    instructions,
    response_format: "mp3",
  });

  const bytes = new Uint8Array(await response.arrayBuffer());
  const hash = createHash("md5").update(normalized).digest("hex");
  const r2Key = `audio/${language}/${hash}.mp3`;

  await uploadAudio(env, r2Key, bytes);
  await db.insert(audioCache).values({ text: normalized, language, r2Key }).onConflictDoNothing();

  return getPublicUrl(r2Key);
}
