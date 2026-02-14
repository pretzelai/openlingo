import { NextRequest, NextResponse } from "next/server";
import { lookupWord } from "@/lib/words";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const word = searchParams.get("word");
  const language = searchParams.get("language");

  if (!word || !language) {
    return NextResponse.json(
      { error: "Missing word or language parameter" },
      { status: 400 }
    );
  }

  const result = await lookupWord(word, language);
  return NextResponse.json(result);
}
