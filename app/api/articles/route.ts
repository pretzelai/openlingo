import { NextResponse } from "next/server";
import { requireSession } from "@/lib/auth-server";
import { db } from "@/lib/db";
import { article } from "@/lib/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET() {
  const session = await requireSession();

  const articles = await db
    .select({
      id: article.id,
      sourceUrl: article.sourceUrl,
      title: article.title,
      sourceLanguage: article.sourceLanguage,
      targetLanguage: article.targetLanguage,
      cefrLevel: article.cefrLevel,
      status: article.status,
      translationProgress: article.translationProgress,
      totalParagraphs: article.totalParagraphs,
      wordCount: article.wordCount,
      createdAt: article.createdAt,
    })
    .from(article)
    .where(eq(article.userId, session.user.id))
    .orderBy(desc(article.createdAt));

  return NextResponse.json(articles);
}
