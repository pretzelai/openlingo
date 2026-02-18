import { NextRequest, NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { article } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import type { WordTimestamp } from "@/lib/audio/align-timestamps";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireSession();
  const { id } = await params;

  const [row] = await db
    .select({
      audioUrl: article.audioUrl,
      audioTimestamps: article.audioTimestamps,
    })
    .from(article)
    .where(and(eq(article.id, id), eq(article.userId, session.user.id)))
    .limit(1);

  if (!row) {
    return NextResponse.json({ error: "Article not found" }, { status: 404 });
  }
  if (!row.audioUrl) {
    return NextResponse.json(
      { error: "No audio available" },
      { status: 404 },
    );
  }
  if (!row.audioTimestamps) {
    return NextResponse.json(
      { error: "No timestamps available" },
      { status: 404 },
    );
  }

  let timestamps: WordTimestamp[];
  try {
    timestamps = JSON.parse(row.audioTimestamps);
  } catch {
    return NextResponse.json(
      { error: "Invalid timestamp data" },
      { status: 500 },
    );
  }

  return NextResponse.json({ timestamps });
}
