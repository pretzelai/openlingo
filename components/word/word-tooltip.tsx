"use client";

import { useState, useEffect } from "react";
import { addOrFailWord } from "@/lib/actions/srs";

interface WordData {
  found: boolean;
  source?: "dictionary" | "ai";
  word: string;
  translation?: string;
  pos?: string;
  gender?: string | null;
  cefrLevel?: string;
  exampleNative?: string;
  exampleEnglish?: string;
}

const cefrColors: Record<string, string> = {
  A1: "bg-lingo-green/20 text-lingo-green",
  A2: "bg-lingo-green/20 text-lingo-green",
  B1: "bg-lingo-blue/20 text-lingo-blue",
  B2: "bg-lingo-blue/20 text-lingo-blue",
  C1: "bg-lingo-purple/20 text-lingo-purple",
  C2: "bg-lingo-purple/20 text-lingo-purple",
};

interface WordTooltipProps {
  word: string;
  language: string;
  onClose: () => void;
}

export function WordTooltip({ word, language }: WordTooltipProps) {
  const [data, setData] = useState<WordData | null>(null);
  const [loading, setLoading] = useState(true);
  const [srsStatus, setSrsStatus] = useState<"added" | "failed" | null>(null);

  // Fetch on mount
  useEffect(() => {
    const cleanWord = word.replace(/[^\p{L}\p{M}'-]/gu, "");
    if (!cleanWord) {
      setData({ found: false, word });
      setLoading(false);
      return;
    }
    fetch(`/api/word/lookup?word=${encodeURIComponent(cleanWord)}&language=${encodeURIComponent(language)}`)
      .then((res) => res.json())
      .then((d) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setData({ found: false, word });
        setLoading(false);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-add or mark as failed when data loads
  useEffect(() => {
    if (!data?.found || !data.translation) return;

    addOrFailWord(data.word, language, data.translation)
      .then((status) => setSrsStatus(status))
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (loading) {
    return (
      <div className="p-4 text-center">
        <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-lingo-green border-t-transparent" />
      </div>
    );
  }

  if (!data?.found) {
    return (
      <div className="p-4">
        <p className="text-sm text-lingo-text-light">No entry found for</p>
        <p className="text-lg font-bold text-lingo-text">{word}</p>
      </div>
    );
  }

  // Show base form note if AI resolved an inflected form
  const isInflected =
    data.source === "ai" &&
    data.word.toLowerCase() !== word.toLowerCase();

  return (
    <div className="p-4 space-y-3">
      {/* Word + translation */}
      <div>
        <p className="text-lg font-bold text-lingo-text">{data.word}</p>
        {isInflected && (
          <p className="text-xs text-lingo-text-light">
            base form of &ldquo;{word}&rdquo;
          </p>
        )}
        <p className="text-base text-lingo-blue font-medium">{data.translation}</p>
      </div>

      {/* Badges */}
      <div className="flex flex-wrap gap-1.5">
        {data.pos && (
          <span className="inline-block rounded-full bg-lingo-gray/50 px-2.5 py-0.5 text-xs font-medium text-lingo-text">
            {data.pos}
          </span>
        )}
        {data.gender && (
          <span className="inline-block rounded-full bg-lingo-orange/20 px-2.5 py-0.5 text-xs font-medium text-lingo-orange">
            {data.gender}
          </span>
        )}
        {data.cefrLevel && (
          <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${cefrColors[data.cefrLevel] ?? "bg-lingo-gray/50 text-lingo-text"}`}>
            {data.cefrLevel}
          </span>
        )}
      </div>

      {/* Example */}
      {data.exampleNative && (
        <div className="rounded-lg bg-lingo-bg p-2.5">
          <p className="text-sm font-medium text-lingo-text">{data.exampleNative}</p>
          {data.exampleEnglish && (
            <p className="text-xs text-lingo-text-light mt-1">{data.exampleEnglish}</p>
          )}
        </div>
      )}

      {/* SRS status indicator */}
      {srsStatus && (
        <div
          className={`w-full rounded-xl py-2.5 text-center text-sm font-bold ${
            srsStatus === "added"
              ? "bg-lingo-green/10 text-lingo-green border-2 border-lingo-green/30"
              : "bg-lingo-orange/10 text-lingo-orange border-2 border-lingo-orange/30"
          }`}
        >
          {srsStatus === "added" ? "Added to My Words" : "Marked for review"}
        </div>
      )}
    </div>
  );
}
