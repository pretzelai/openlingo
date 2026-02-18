"use client";

import { useState, useEffect, use } from "react";
import { useRouter } from "next/navigation";
import { TranslatedText } from "@/components/article/translated-text";
import type { TranslationBlock } from "@/lib/article/types";

interface ArticleData {
  id: string;
  sourceUrl: string;
  title: string | null;
  sourceLanguage: string | null;
  targetLanguage: string;
  cefrLevel: string;
  originalContent: string | null;
  translatedContent: string | null;
  status: string;
  translationProgress: number;
  totalParagraphs: number;
  errorMessage: string | null;
  wordCount: number | null;
  createdAt: string;
}

export default function ArticleReaderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [article, setArticle] = useState<ArticleData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch article
  useEffect(() => {
    fetch(`/api/articles/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => {
        setArticle(data);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [id]);

  // Poll for status if in progress
  useEffect(() => {
    if (!article) return;
    if (article.status === "completed" || article.status === "failed") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/articles/${id}`);
        if (!res.ok) return;
        const data = await res.json();
        setArticle(data);
        if (data.status === "completed" || data.status === "failed") {
          clearInterval(interval);
        }
      } catch {
        // ignore
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [id, article?.status]);

  const handleDelete = async () => {
    if (!confirm("Delete this article?")) return;
    setDeleting(true);
    try {
      await fetch(`/api/articles/${id}`, { method: "DELETE" });
      router.push("/read");
    } catch {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-lingo-green border-t-transparent" />
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="mx-auto max-w-2xl text-center py-20">
        <p className="text-lingo-text-light">Article not found</p>
        <button
          type="button"
          onClick={() => router.push("/read")}
          className="mt-4 text-lingo-blue font-bold text-sm"
        >
          Back to articles
        </button>
      </div>
    );
  }

  const isInProgress =
    article.status === "fetching" || article.status === "translating";
  const blocks: TranslationBlock[] = article.translatedContent
    ? JSON.parse(article.translatedContent)
    : [];

  const sourceDomain = (() => {
    try {
      return new URL(article.sourceUrl).hostname.replace("www.", "");
    } catch {
      return article.sourceUrl;
    }
  })();

  const cefrColors: Record<string, string> = {
    A1: "bg-lingo-green/20 text-lingo-green",
    A2: "bg-lingo-green/20 text-lingo-green",
    B1: "bg-lingo-blue/20 text-lingo-blue",
    B2: "bg-lingo-blue/20 text-lingo-blue",
    C1: "bg-lingo-purple/20 text-lingo-purple",
    C2: "bg-lingo-purple/20 text-lingo-purple",
  };

  return (
    <div className="mx-auto max-w-2xl">
      {/* Header */}
      <div className="mb-6">
        <button
          type="button"
          onClick={() => router.push("/read")}
          className="flex items-center gap-1 text-sm font-bold text-lingo-text-light hover:text-lingo-text transition-colors mb-4"
        >
          <svg
            className="h-4 w-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          All articles
        </button>

        <h1 className="text-2xl font-black text-lingo-text mb-2">
          {article.title || "Untitled"}
        </h1>

        {/* Metadata */}
        <div className="flex flex-wrap items-center gap-2 mb-2">
          {article.targetLanguage && (
            <span className="inline-block rounded-full bg-lingo-gray/50 px-2.5 py-0.5 text-xs font-medium text-lingo-text">
              {article.targetLanguage}
            </span>
          )}
          <span
            className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cefrColors[article.cefrLevel] ?? "bg-lingo-gray/50 text-lingo-text"}`}
          >
            {article.cefrLevel}
          </span>
          {article.wordCount && article.wordCount > 0 && (
            <span className="inline-block rounded-full bg-lingo-gray/50 px-2.5 py-0.5 text-xs font-medium text-lingo-text-light">
              {article.wordCount} words
            </span>
          )}
          <a
            href={article.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-full bg-lingo-gray/50 px-2.5 py-0.5 text-xs font-medium text-lingo-text-light hover:text-lingo-blue transition-colors"
          >
            {sourceDomain}
            <svg
              className="h-3 w-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
              />
            </svg>
          </a>
        </div>

        {/* Delete button */}
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleting}
          className="text-xs text-lingo-red font-medium hover:underline disabled:opacity-50"
        >
          {deleting ? "Deleting..." : "Delete article"}
        </button>
      </div>

      {/* Translation progress banner */}
      {isInProgress && (
        <div className="rounded-xl border-2 border-lingo-blue/20 bg-lingo-blue/5 p-4 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-lingo-blue/30 border-t-lingo-blue" />
            <span className="text-sm font-bold text-lingo-blue">
              {article.status === "fetching"
                ? "Fetching article..."
                : "Translating..."}
            </span>
          </div>
          {article.totalParagraphs > 0 && (
            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 rounded-full bg-lingo-blue/10 overflow-hidden">
                <div
                  className="h-full rounded-full bg-lingo-blue transition-all duration-500"
                  style={{
                    width: `${(article.translationProgress / article.totalParagraphs) * 100}%`,
                  }}
                />
              </div>
              <span className="text-xs font-medium text-lingo-blue">
                {article.translationProgress}/{article.totalParagraphs}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Error banner */}
      {article.status === "failed" && (
        <div className="rounded-xl border-2 border-lingo-red/20 bg-red-50 p-4 mb-6">
          <p className="text-sm font-bold text-lingo-red mb-1">
            Translation failed
          </p>
          {article.errorMessage && (
            <p className="text-xs text-lingo-red/80">
              {article.errorMessage}
            </p>
          )}
        </div>
      )}

      {/* Article content */}
      {blocks.length > 0 && (
        <TranslatedText
          blocks={blocks}
          targetLanguage={article.targetLanguage}
        />
      )}

      {/* Empty state for articles with no content yet */}
      {blocks.length === 0 && !isInProgress && article.status !== "failed" && (
        <div className="text-center py-12 text-lingo-text-light">
          No content available yet.
        </div>
      )}
    </div>
  );
}
