import { createHash } from "crypto";
import OpenAI from "openai";
import { db } from "@/lib/db";
import { audioCache } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { uploadAudio, getPublicUrl } from "@/lib/r2";

const openai = new OpenAI();

const TTS_INSTRUCTIONS: Record<string, string> = {
  de: "Speak in German with clear, native pronunciation. Calm, measured pace for learners.",
  es: "Speak in Spanish with clear, native pronunciation. Calm, measured pace for learners.",
  fr: "Speak in French with clear, native pronunciation. Calm, measured pace for learners.",
  it: "Speak in Italian with clear, native pronunciation. Calm, measured pace for learners.",
  pt: "Speak in Portuguese with clear, native pronunciation. Calm, measured pace for learners.",
  ru: "Speak in Russian with clear, native pronunciation. Calm, measured pace for learners.",
  ar: "Speak in Arabic with clear, native pronunciation. Calm, measured pace for learners.",
  hi: "Speak in Hindi with clear, native pronunciation. Calm, measured pace for learners.",
  ko: "Speak in Korean with clear, native pronunciation. Calm, measured pace for learners.",
  zh: "Speak in Mandarin Chinese with clear, native pronunciation. Calm, measured pace for learners.",
  ja: "Speak in Japanese with clear, native pronunciation. Calm, measured pace for learners.",
  en: "Speak in English with clear pronunciation. Calm, measured pace for learners.",
  tr: "Speak in Turkish with clear, native pronunciation. Calm, measured pace for learners.",
  pl: "Speak in Polish with clear, native pronunciation. Calm, measured pace for learners.",
};

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
  const instructions =
    TTS_INSTRUCTIONS[language] ||
    `Speak in the target language with clear pronunciation. Calm, measured pace for learners.`;

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
