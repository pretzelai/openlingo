import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { toFile } from "openai/uploads";
import { requireSession } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { article } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { uploadAudio, getPublicUrl } from "@/lib/r2";
import {
  alignWordsToOriginal,
  type WhisperWord,
} from "@/lib/audio/align-timestamps";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

interface TranslationBlock {
  original: string;
  translated: string;
}

const TTS_INSTRUCTIONS: Record<string, string> = {
  German:
    "Speak in German with clear, native German pronunciation. Use a calm, measured pace suitable for language learners. Enunciate clearly and naturally.",
  Spanish:
    "Speak in Spanish with clear, native Spanish pronunciation. Use a calm, measured pace suitable for language learners. Enunciate clearly and naturally.",
  French:
    "Speak in French with clear, native French pronunciation. Use a calm, measured pace suitable for language learners. Enunciate clearly and naturally.",
  Italian:
    "Speak in Italian with clear, native Italian pronunciation. Use a calm, measured pace suitable for language learners. Enunciate clearly and naturally.",
  Portuguese:
    "Speak in Portuguese with clear, native Portuguese pronunciation. Use a calm, measured pace suitable for language learners. Enunciate clearly and naturally.",
};

// GET - Get audio URL for existing audio
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  const { id } = await params;

  const [row] = await db
    .select({ audioUrl: article.audioUrl })
    .from(article)
    .where(and(eq(article.id, id), eq(article.userId, session.user.id)))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }
  if (!row.audioUrl) {
    return NextResponse.json({ error: "No audio available" }, { status: 404 });
  }
  if (row.audioUrl === "generating") {
    return NextResponse.json({ status: "generating" });
  }

  return NextResponse.json({ audioUrl: getPublicUrl(row.audioUrl) });
}

// Background audio generation (fire-and-forget)
async function generateAudioInBackground(
  articleId: string,
  translatedContent: string,
  targetLanguage: string,
) {
  try {
    let blocks: TranslationBlock[];
    try {
      blocks = JSON.parse(translatedContent);
    } catch {
      console.error(`[Audio] Invalid article content for ${articleId}`);
      await db
        .update(article)
        .set({ audioUrl: null })
        .where(eq(article.id, articleId));
      return;
    }

    // Combine translated text (OpenAI TTS limit is 4096 chars)
    const translatedText = blocks
      .map((block) => block.translated)
      .join("\n\n")
      .slice(0, 4096);

    // Generate audio with OpenAI TTS
    const ttsInstructions =
      TTS_INSTRUCTIONS[targetLanguage] ||
      `Speak in ${targetLanguage} with clear, native pronunciation. Use a calm, measured pace suitable for language learners.`;

    const mp3 = await openai.audio.speech.create({
      model: "gpt-4o-mini-tts",
      voice: "coral",
      input: translatedText,
      instructions: ttsInstructions,
    });

    const buffer = Buffer.from(await mp3.arrayBuffer());

    // Upload to R2
    const audioKey = `article-audio/${articleId}.mp3`;
    await uploadAudio(audioKey, buffer);

    // Transcribe with Whisper for word-level timestamps
    let audioTimestamps: string | null = null;
    try {
      const audioFile = await toFile(buffer, "audio.mp3", {
        type: "audio/mpeg",
      });
      const transcription = await openai.audio.transcriptions.create({
        file: audioFile,
        model: "whisper-1",
        response_format: "verbose_json",
        timestamp_granularities: ["word"],
      });

      const verboseResponse = transcription as {
        words?: Array<{ word: string; start: number; end: number }>;
      };

      if (verboseResponse.words && verboseResponse.words.length > 0) {
        const whisperWords: WhisperWord[] = verboseResponse.words.map(
          (w) => ({
            word: w.word,
            start: w.start,
            end: w.end,
          }),
        );

        const aligned = alignWordsToOriginal(translatedText, whisperWords);
        audioTimestamps = JSON.stringify(aligned);
        console.log(
          `[Audio] Generated ${aligned.length} word timestamps for article ${articleId}`,
        );
      }
    } catch (transcriptionError) {
      console.error(
        "[Audio] Whisper transcription failed:",
        transcriptionError,
      );
    }

    // Estimate duration (~150 words per minute)
    const wordCount = translatedText.split(/\s+/).length;
    const estimatedDuration = Math.round((wordCount / 150) * 60);

    // Update article with audio info
    await db
      .update(article)
      .set({
        audioUrl: audioKey,
        audioDurationSeconds: estimatedDuration,
        audioTimestamps,
      })
      .where(eq(article.id, articleId));

    console.log(`[Audio] Audio generation complete for article ${articleId}`);
  } catch (error) {
    console.error(`[Audio] Audio generation failed for ${articleId}:`, error);
    // Reset audioUrl so user can retry
    await db
      .update(article)
      .set({ audioUrl: null })
      .where(eq(article.id, articleId));
  }
}

// POST - Generate audio for article (returns immediately, runs in background)
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  const { id } = await params;

  const [row] = await db
    .select()
    .from(article)
    .where(and(eq(article.id, id), eq(article.userId, session.user.id)))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }

  // If audio already exists (and not in generating state), return existing URL
  if (row.audioUrl && row.audioUrl !== "generating") {
    return NextResponse.json({ audioUrl: getPublicUrl(row.audioUrl) });
  }

  // If already generating, just return status
  if (row.audioUrl === "generating") {
    return NextResponse.json({ status: "generating" });
  }

  if (!row.translatedContent) {
    return NextResponse.json(
      { error: "Article translation not complete" },
      { status: 400 },
    );
  }

  // Mark as generating immediately
  await db
    .update(article)
    .set({ audioUrl: "generating" })
    .where(eq(article.id, id));

  // Fire-and-forget background generation
  generateAudioInBackground(
    id,
    row.translatedContent,
    row.targetLanguage,
  ).catch((err) =>
    console.error(`[Audio] Unhandled error for ${id}:`, err),
  );

  return NextResponse.json({ status: "generating" });
}
