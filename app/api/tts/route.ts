import { NextRequest, NextResponse } from "next/server";
import { generateSpeech } from "@/lib/tts";
import { getAudio } from "@/lib/r2";

export async function GET(request: NextRequest) {
  const key = request.nextUrl.searchParams.get("key");
  if (!key) {
    return NextResponse.json({ error: "key is required" }, { status: 400 });
  }

  const buffer = await getAudio(key);
  if (!buffer) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "audio/mpeg",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}

export async function POST(request: NextRequest) {
  const body = await request.json();
  const { text, language } = body;

  if (!text || typeof text !== "string") {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  if (!language || typeof language !== "string") {
    return NextResponse.json(
      { error: "language is required" },
      { status: 400 }
    );
  }
  if (text.length > 4096) {
    return NextResponse.json(
      { error: "text must be under 4096 characters" },
      { status: 400 }
    );
  }

  const url = await generateSpeech(text, language);
  return NextResponse.json({ url });
}
