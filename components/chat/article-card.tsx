"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

interface ArticleCardProps {
  articleId: string;
  initialStatus: string;
  initialTitle?: string;
  url: string;
}

export function ArticleCard({
  articleId,
  initialStatus,
  initialTitle,
  url,
}: ArticleCardProps) {
  const router = useRouter();
  const [status, setStatus] = useState(initialStatus);
  const [title, setTitle] = useState(initialTitle || "Translating...");
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);

  // Poll for status if not completed
  useEffect(() => {
    if (status === "completed" || status === "failed") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/articles/${articleId}/status`);
        if (!res.ok) return;
        const data = await res.json();
        setStatus(data.status);
        setProgress(data.translationProgress || 0);
        setTotal(data.totalParagraphs || 0);
        if (data.title) setTitle(data.title);
        if (data.status === "completed" || data.status === "failed") {
          clearInterval(interval);
        }
      } catch {
        // ignore
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [articleId, status]);

  const isInProgress = status === "fetching" || status === "translating";
  const sourceDomain = (() => {
    try {
      return new URL(url).hostname.replace("www.", "");
    } catch {
      return url;
    }
  })();

  return (
    <div className="w-full overflow-hidden rounded-xl border-2 border-lingo-border bg-white">
      {/* Header */}
      <div className="flex items-start gap-3 px-4 py-3">
        <span className="text-3xl">📖</span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-bold text-lingo-text">
            {title}
          </h3>
          <p className="mt-0.5 text-xs text-lingo-text-light">{sourceDomain}</p>
        </div>
        {status === "completed" && (
          <svg
            className="h-5 w-5 shrink-0 text-lingo-green"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
        {status === "failed" && (
          <svg
            className="h-5 w-5 shrink-0 text-lingo-red"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        )}
      </div>

      {/* Progress bar */}
      {isInProgress && (
        <div className="px-4 pb-3">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-2 rounded-full bg-lingo-gray overflow-hidden">
              <div
                className="h-full rounded-full bg-lingo-blue transition-all duration-500"
                style={{
                  width: total > 0 ? `${(progress / total) * 100}%` : "0%",
                }}
              />
            </div>
            <span className="text-[10px] font-medium text-lingo-text-light shrink-0">
              {status === "fetching"
                ? "Fetching..."
                : total > 0
                  ? `${progress}/${total}`
                  : "Starting..."}
            </span>
          </div>
        </div>
      )}

      {/* Action button */}
      <div className="border-t border-lingo-border/50 px-4 py-3">
        <button
          type="button"
          onClick={() => router.push(`/read/${articleId}`)}
          disabled={status === "fetching"}
          className="w-full rounded-xl bg-lingo-green py-2.5 text-sm font-bold text-white shadow-[0_4px_0_0] shadow-lingo-green-dark active:translate-y-[2px] active:shadow-[0_2px_0_0] active:shadow-lingo-green-dark transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {status === "completed"
            ? "Read Article"
            : status === "failed"
              ? "View Details"
              : "View Progress"}
        </button>
      </div>
    </div>
  );
}
