"use client";

import { useState, useEffect, useCallback } from "react";
import { reviewCard, getScheduledCards } from "@/lib/actions/srs";
import type { Quality } from "@/lib/srs";

type SrsCard = {
  word: string;
  language: string;
  translation: string;
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewAt: Date;
  lastReviewedAt: Date | null;
  createdAt: Date;
};

type Stats = {
  total: number;
  due: number;
  learned: number;
};

type CardPhase = "front" | "back" | "rated";

const QUALITY_BUTTONS: { label: string; quality: Quality; color: string }[] = [
  { label: "Again", quality: 0, color: "bg-red-500 hover:bg-red-600" },
  { label: "Hard", quality: 3, color: "bg-orange-500 hover:bg-orange-600" },
  { label: "Good", quality: 4, color: "bg-lingo-blue hover:bg-lingo-blue/90" },
  { label: "Easy", quality: 5, color: "bg-lingo-green hover:bg-lingo-green/90" },
];

const PLACEHOLDER_KEYS = [
  "word",
  "language",
  "translation",
  "ease_factor",
  "interval",
  "repetitions",
  "next_review_at",
  "last_reviewed_at",
  "created_at",
] as const;

function interpolatePrompt(template: string, card: SrsCard): string {
  return template
    .replace(/\{word\}/g, card.word)
    .replace(/\{language\}/g, card.language)
    .replace(/\{translation\}/g, card.translation)
    .replace(/\{ease_factor\}/g, String(card.easeFactor))
    .replace(/\{interval\}/g, String(card.interval))
    .replace(/\{repetitions\}/g, String(card.repetitions))
    .replace(/\{next_review_at\}/g, card.nextReviewAt?.toISOString() ?? "")
    .replace(/\{last_reviewed_at\}/g, card.lastReviewedAt?.toISOString() ?? "never")
    .replace(/\{created_at\}/g, card.createdAt?.toISOString() ?? "");
}

export function ReviewSession({
  dueCards,
  stats,
}: {
  dueCards: SrsCard[];
  stats: Stats;
}) {
  const [cards, setCards] = useState<SrsCard[]>(dueCards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [phase, setPhase] = useState<CardPhase>("front");
  const [completed, setCompleted] = useState(false);
  const [scheduledLoading, setScheduledLoading] = useState(false);
  const [isScheduledMode, setIsScheduledMode] = useState(false);

  // AI prompt state
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiPromptTemplate, setAiPromptTemplate] = useState("");
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Load AI settings from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("review-ai-prompt");
    if (saved) setAiPromptTemplate(saved);
    const enabled = localStorage.getItem("review-ai-enabled");
    if (enabled === "true") setAiEnabled(true);
  }, []);

  // Save AI settings to localStorage
  useEffect(() => {
    localStorage.setItem("review-ai-prompt", aiPromptTemplate);
  }, [aiPromptTemplate]);

  useEffect(() => {
    localStorage.setItem("review-ai-enabled", String(aiEnabled));
  }, [aiEnabled]);

  async function startScheduledReview() {
    setScheduledLoading(true);
    try {
      const scheduled = await getScheduledCards("de");
      if (scheduled.length > 0) {
        setCards(scheduled);
        setCurrentIndex(0);
        setPhase("front");
        setCompleted(false);
        setIsScheduledMode(true);
        setAiResponse(null);
      }
    } finally {
      setScheduledLoading(false);
    }
  }

  const card = cards[currentIndex];

  const fetchAiPrompt = useCallback(
    async (c: SrsCard) => {
      if (!aiEnabled || !aiPromptTemplate.trim()) return;
      setAiLoading(true);
      setAiResponse(null);
      try {
        const interpolated = interpolatePrompt(aiPromptTemplate, c);
        const res = await fetch("/api/review/ai-prompt", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: interpolated }),
        });
        if (res.ok) {
          const data = await res.json();
          setAiResponse(data.result);
        }
      } catch {
        // Silently skip AI failures
      } finally {
        setAiLoading(false);
      }
    },
    [aiEnabled, aiPromptTemplate]
  );

  // Fetch AI prompt when card changes
  useEffect(() => {
    if (card && !completed) {
      fetchAiPrompt(card);
    }
  }, [currentIndex, completed, card, fetchAiPrompt]);

  const isReviewing = cards.length > 0 && !completed;

  const aiSettingsPanel = (
    <div className="mb-4">
      <button
        onClick={() => setShowSettings(!showSettings)}
        className="text-sm font-bold text-lingo-text-light hover:text-lingo-text transition-colors"
      >
        {showSettings ? "▾ AI Prompt Settings" : "▸ AI Prompt Settings"}
      </button>

      {showSettings && (
        <div className="mt-2 p-4 bg-lingo-gray/30 rounded-xl border-2 border-lingo-border">
          <label className="flex items-center gap-2 mb-3">
            <input
              type="checkbox"
              checked={aiEnabled}
              onChange={(e) => setAiEnabled(e.target.checked)}
              className="rounded"
            />
            <span className="text-sm font-bold text-lingo-text">
              Enable AI prompt
            </span>
          </label>
          <textarea
            value={aiPromptTemplate}
            onChange={(e) => setAiPromptTemplate(e.target.value)}
            placeholder="e.g. Give me a sentence using {word} in {language}"
            className="w-full h-24 p-3 text-sm rounded-xl border-2 border-lingo-border bg-white resize-none focus:outline-none focus:border-lingo-blue"
          />
          <p className="mt-2 text-xs text-lingo-text-light">
            Placeholders:{" "}
            {PLACEHOLDER_KEYS.map((k) => (
              <code
                key={k}
                className="mx-0.5 px-1 py-0.5 bg-lingo-gray rounded text-xs"
              >
                {`{${k}}`}
              </code>
            ))}
          </p>
        </div>
      )}
    </div>
  );

  if (cards.length === 0) {
    return (
      <div className="py-6">
        {aiSettingsPanel}
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h2 className="text-2xl font-black text-lingo-text mb-2">
            No cards due!
          </h2>
          <p className="text-lingo-text-light font-bold">
            You&apos;re all caught up. Come back later when more cards are ready
            for review.
          </p>
          <div className="mt-6 flex gap-4 text-sm font-bold text-lingo-text-light">
            <span>{stats.total} total cards</span>
            <span>·</span>
            <span>{stats.learned} learned</span>
          </div>
          {stats.total > 0 && (
            <button
              onClick={startScheduledReview}
              disabled={scheduledLoading}
              className="mt-6 px-6 py-3 bg-lingo-blue text-white font-bold rounded-xl border-b-4 border-lingo-blue/70 active:border-b-0 active:mt-[25px] transition-all disabled:opacity-50"
            >
              {scheduledLoading ? "Loading..." : "Review scheduled cards"}
            </button>
          )}
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <div className="py-6">
        {aiSettingsPanel}
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-2xl font-black text-lingo-text mb-2">
            Session complete!
          </h2>
          <p className="text-lingo-text-light font-bold mb-6">
            You reviewed {cards.length} card{cards.length !== 1 && "s"}.
          </p>
          <div className="flex gap-4 text-sm font-bold text-lingo-text-light">
            <span>{stats.total} total cards</span>
            <span>·</span>
            <span>{stats.learned} learned</span>
          </div>
          {!isScheduledMode && stats.total > stats.due && (
            <button
              onClick={startScheduledReview}
              disabled={scheduledLoading}
              className="mt-6 px-6 py-3 bg-lingo-blue text-white font-bold rounded-xl border-b-4 border-lingo-blue/70 active:border-b-0 active:mt-[25px] transition-all disabled:opacity-50"
            >
              {scheduledLoading ? "Loading..." : "Review scheduled cards"}
            </button>
          )}
        </div>
      </div>
    );
  }

  async function handleRate(quality: Quality) {
    setPhase("rated");
    await reviewCard(card.word, card.language, quality);

    const nextIndex = currentIndex + 1;
    if (nextIndex >= cards.length) {
      setCompleted(true);
    } else {
      setCurrentIndex(nextIndex);
      setPhase("front");
      setAiResponse(null);
    }
  }

  const progress = currentIndex / cards.length;

  return (
    <div className="py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-xl font-black text-lingo-text">
          Review{isScheduledMode && " (Scheduled)"}
        </h1>
        <div className="flex items-center gap-3">
          {!isScheduledMode && (
            <button
              onClick={startScheduledReview}
              disabled={scheduledLoading}
              className="text-sm font-bold text-lingo-blue hover:text-lingo-blue/80 transition-colors disabled:opacity-50"
            >
              {scheduledLoading ? "Loading..." : "Review scheduled"}
            </button>
          )}
          <span className="text-sm font-bold text-lingo-text-light">
            {currentIndex + 1} / {cards.length}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-3 bg-lingo-gray rounded-full overflow-hidden mb-6 border-2 border-lingo-border">
        <div
          className="h-full bg-lingo-green rounded-full transition-all duration-300"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      {/* AI Settings toggle */}
      {aiSettingsPanel}

      {/* AI Response / Loading */}
      {aiEnabled && aiPromptTemplate.trim() && (
        <div className="mb-4 min-h-[3rem]">
          {aiLoading && (
            <div className="flex items-center gap-2 p-3 bg-lingo-gray/30 rounded-xl border-2 border-lingo-border">
              <div className="h-4 w-4 border-2 border-lingo-blue border-t-transparent rounded-full animate-spin" />
              <span className="text-sm text-lingo-text-light font-bold">
                Loading AI response...
              </span>
            </div>
          )}
          {!aiLoading && aiResponse && (
            <div className="p-3 bg-lingo-blue/5 rounded-xl border-2 border-lingo-blue/20">
              <p className="text-sm text-lingo-text whitespace-pre-wrap">
                {aiResponse}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Flashcard */}
      <div
        onClick={() => phase === "front" && setPhase("back")}
        className={`relative rounded-2xl border-2 border-b-4 p-8 text-center transition-all ${
          phase === "front"
            ? "border-lingo-border bg-white cursor-pointer hover:bg-lingo-gray/20 active:border-b-2 active:mt-[2px]"
            : "border-lingo-border bg-white"
        }`}
      >
        {/* Word (always visible) */}
        <p className="text-3xl font-black text-lingo-text mb-2">{card.word}</p>

        {phase === "front" && (
          <p className="text-sm text-lingo-text-light font-bold">
            Tap to reveal
          </p>
        )}

        {/* Translation (revealed) */}
        {phase === "back" && (
          <div className="mt-4 pt-4 border-t-2 border-lingo-border">
            <p className="text-xl font-bold text-lingo-text-light">
              {card.translation}
            </p>
          </div>
        )}
      </div>

      {/* Quality buttons (shown when back is revealed) */}
      {phase === "back" && (
        <div className="grid grid-cols-4 gap-2 mt-4">
          {QUALITY_BUTTONS.map((btn) => (
            <button
              key={btn.quality}
              onClick={() => handleRate(btn.quality)}
              className={`${btn.color} text-white font-bold py-3 px-2 rounded-xl border-b-4 border-black/20 active:border-b-0 active:mt-1 transition-all text-sm`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
