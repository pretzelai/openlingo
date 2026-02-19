import { NextRequest, NextResponse } from "next/server";
import { generateText } from "ai";
import { getModel } from "@/lib/ai/models";
import { requireSession } from "@/lib/auth-server";

export async function POST(request: NextRequest) {
  await requireSession();
  const body = await request.json();
  const { prompt } = body;

  if (!prompt || typeof prompt !== "string") {
    return NextResponse.json(
      { error: "Missing prompt parameter" },
      { status: 400 }
    );
  }

  try {
    const { text } = await generateText({
      model: getModel("gemini-2.5-flash-lite"),
      prompt,
    });

    return NextResponse.json({ result: text });
  } catch (err) {
    console.error("AI prompt failed:", err);
    return NextResponse.json(
      { error: "AI generation failed" },
      { status: 500 }
    );
  }
}
