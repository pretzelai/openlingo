import { createHash } from "crypto";
import OpenAI from "openai";
import { db } from "@/lib/db";
import { audioCache } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { uploadAudio, getPublicUrl } from "@/lib/r2";
import { getDefaultTemplate, interpolateTemplate, langCodeToName } from "@/lib/prompts";

const openai = new OpenAI();

export async function generateSpeech(
  text: string,
  language: string
): Promise<string> {
  const normalized = text.toLowerCase();

  // Check cache
  const cached = await db
    .select()
    .from(audioCache)
    .where(
      and(eq(audioCache.text, normalized), eq(audioCache.language, language))
    )
    .limit(1);

  if (cached.length > 0) {
    return getPublicUrl(cached[0].r2Key);
  }

  // Generate with OpenAI TTS
  const language_name = langCodeToName[language] || "the target language";
  const ttsTemplate = getDefaultTemplate("tts-instructions");
  const instructions = interpolateTemplate(ttsTemplate, { language_name });

  const response = await openai.audio.speech.create({
    model: "gpt-4o-mini-tts",
    voice: "coral",
    input: text,
    instructions,
    response_format: "mp3",
  });

  const buffer = Buffer.from(await response.arrayBuffer());
  const hash = createHash("md5").update(normalized).digest("hex");
  const r2Key = `audio/${language}/${hash}.mp3`;

  await uploadAudio(r2Key, buffer);

  // Cache in DB
  await db
    .insert(audioCache)
    .values({ text: normalized, language, r2Key })
    .onConflictDoNothing();

  return getPublicUrl(r2Key);
}
