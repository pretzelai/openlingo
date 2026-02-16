"use client";

import { useState, useMemo, useTransition } from "react";
import { bulkAddWordsToSrs, addWordToSrs, removeWordFromSrs, removeAllWordsFromSrs } from "@/lib/actions/srs";
import { useRouter } from "next/navigation";

interface Word {
  word: string;
  cefr_level: string;
  english_translation: string;
  pos: string;
  example_sentence_native: string;
  example_sentence_english: string;
  gender: string;
  word_frequency?: number;
}

interface SrsCard {
  word: string;
  language: string;
  translation: string;
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewAt: Date;
  lastReviewedAt: Date | null;
  createdAt: Date;
}

interface SrsStats {
  total: number;
  due: number;
  learned: number;
}

const CEFR_LEVELS = ["A1", "A2", "B1", "B2", "C1", "C2"] as const;
const PAGE_SIZE = 50;

const LEVEL_COLORS: Record<string, string> = {
  A1: "bg-lingo-green text-white",
  A2: "bg-lingo-green-dark text-white",
  B1: "bg-lingo-blue text-white",
  B2: "bg-lingo-blue-dark text-white",
  C1: "bg-lingo-purple text-white",
  C2: "bg-lingo-red text-white",
};

const POS_LABELS: Record<string, string> = {
  noun: "Noun",
  verb: "Verb",
  adj: "Adj",
  adjective: "Adj",
  adjektiv: "Adj",
  adv: "Adv",
  adverb: "Adv",
  pronoun: "Pron",
  conjunction: "Conj",
  interjection: "Intj",
  num: "Num",
  number: "Num",
  numeral: "Num",
};

type Tab = "all" | "my-words";
type SrsFilter = "all" | "due" | "new" | "learning" | "learned";

export function WordExplorer({
  words,
  srsCards,
  srsStats,
  language,
}: {
  words: Word[];
  srsCards: SrsCard[];
  srsStats: SrsStats;
  language: string;
}) {
  const [tab, setTab] = useState<Tab>("all");

  return (
    <div>
      {/* Header */}
      <div className="mb-6 text-center">
        <h1 className="text-2xl font-black text-lingo-text">Words</h1>
        <p className="text-sm text-lingo-text-light mt-1">
          {words.length.toLocaleString()} words available
        </p>
      </div>

      {/* Tabs */}
      <div className="mb-5 flex rounded-xl border-2 border-lingo-border bg-lingo-card overflow-hidden">
        <button
          onClick={() => setTab("all")}
          className={`flex-1 py-2.5 text-sm font-bold transition-colors ${
            tab === "all"
              ? "bg-lingo-blue text-white"
              : "text-lingo-text-light hover:text-lingo-text"
          }`}
        >
          All Words
        </button>
        <button
          onClick={() => setTab("my-words")}
          className={`flex-1 py-2.5 text-sm font-bold transition-colors ${
            tab === "my-words"
              ? "bg-lingo-blue text-white"
              : "text-lingo-text-light hover:text-lingo-text"
          }`}
        >
          My Words
          {srsStats.total > 0 && (
            <span className="ml-1.5 text-xs opacity-80">
              ({srsStats.total})
            </span>
          )}
        </button>
      </div>

      {tab === "all" ? (
        <AllWordsTab words={words} srsCards={srsCards} language={language} />
      ) : (
        <MyWordsTab srsCards={srsCards} srsStats={srsStats} language={language} />
      )}
    </div>
  );
}

/* ─── All Words Tab ─── */

function AllWordsTab({
  words,
  srsCards,
  language,
}: {
  words: Word[];
  srsCards: SrsCard[];
  language: string;
}) {
  const [selectedLevel, setSelectedLevel] = useState<string>("");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const srsSet = useMemo(
    () => new Set(srsCards.map((c) => c.word)),
    [srsCards]
  );

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return words.filter((w) => {
      if (selectedLevel && w.cefr_level !== selectedLevel) return false;
      if (
        q &&
        !w.word.toLowerCase().includes(q) &&
        !w.english_translation.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [words, selectedLevel, search]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  const levelWords = useMemo(() => {
    if (!selectedLevel) return [];
    return words.filter((w) => w.cefr_level === selectedLevel);
  }, [words, selectedLevel]);

  const newWordsInLevel = useMemo(
    () => levelWords.filter((w) => !srsSet.has(w.word.toLowerCase())),
    [levelWords, srsSet]
  );

  function handleLevelClick(level: string) {
    setSelectedLevel((prev) => (prev === level ? "" : level));
    setVisibleCount(PAGE_SIZE);
  }

  function handleBulkAdd() {
    startTransition(async () => {
      await bulkAddWordsToSrs(
        newWordsInLevel.map((w) => ({
          word: w.word,
          translation: w.english_translation,
        })),
        language
      );
      router.refresh();
    });
  }

  function handleToggleWord(word: Word) {
    const key = word.word.toLowerCase();
    startTransition(async () => {
      if (srsSet.has(key)) {
        await removeWordFromSrs(word.word, language);
      } else {
        await addWordToSrs(word.word, language, word.english_translation);
      }
      router.refresh();
    });
  }

  return (
    <div>
      {/* CEFR level pills */}
      <div className="mb-4 flex flex-wrap gap-2">
        {CEFR_LEVELS.map((level) => {
          const count = words.filter((w) => w.cefr_level === level).length;
          const active = selectedLevel === level;
          return (
            <button
              key={level}
              onClick={() => handleLevelClick(level)}
              className={`rounded-full px-4 py-1.5 text-sm font-bold transition-all ${
                active
                  ? LEVEL_COLORS[level]
                  : "bg-lingo-card border-2 border-lingo-border text-lingo-text hover:border-lingo-gray-dark"
              }`}
            >
              {level}
              <span
                className={`ml-1.5 text-xs ${active ? "opacity-80" : "text-lingo-text-light"}`}
              >
                {count.toLocaleString()}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bulk add button */}
      {selectedLevel && newWordsInLevel.length > 0 && (
        <button
          onClick={handleBulkAdd}
          disabled={isPending}
          className="mb-4 w-full rounded-xl bg-lingo-green py-3 text-sm font-bold text-white hover:bg-lingo-green-dark transition-colors disabled:opacity-50"
        >
          {isPending
            ? "Adding..."
            : `Add all ${newWordsInLevel.length} ${selectedLevel} words to My Words`}
        </button>
      )}

      {selectedLevel && newWordsInLevel.length === 0 && levelWords.length > 0 && (
        <p className="mb-4 rounded-xl border-2 border-lingo-green/30 bg-lingo-green/5 py-3 text-center text-sm font-bold text-lingo-green-dark">
          All {selectedLevel} words already in My Words
        </p>
      )}

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search words or translations..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setVisibleCount(PAGE_SIZE);
          }}
          className="w-full rounded-xl border-2 border-lingo-border bg-lingo-card px-4 py-2.5 text-sm font-bold text-lingo-text placeholder:text-lingo-text-light/60 focus:border-lingo-blue focus:outline-none"
        />
      </div>

      {/* Results count */}
      <p className="mb-3 text-xs font-bold text-lingo-text-light">
        {filtered.length.toLocaleString()} word
        {filtered.length !== 1 ? "s" : ""}
        {selectedLevel && ` at ${selectedLevel}`}
        {search && ` matching "${search}"`}
      </p>

      {/* Word list */}
      {filtered.length === 0 ? (
        <p className="py-12 text-center text-lingo-text-light">
          No words found.
        </p>
      ) : (
        <div className="space-y-2">
          {visible.map((w, i) => (
            <AllWordCard
              key={`${w.word}-${i}`}
              word={w}
              inSrs={srsSet.has(w.word.toLowerCase())}
              onToggle={() => handleToggleWord(w)}
              isPending={isPending}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <button
          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          className="mt-4 w-full rounded-xl border-2 border-lingo-border bg-lingo-card py-3 text-sm font-bold text-lingo-text-light hover:border-lingo-gray-dark hover:text-lingo-text transition-colors"
        >
          Show more ({Math.min(PAGE_SIZE, filtered.length - visibleCount)} of{" "}
          {(filtered.length - visibleCount).toLocaleString()} remaining)
        </button>
      )}
    </div>
  );
}

function AllWordCard({
  word: w,
  inSrs,
  onToggle,
  isPending,
}: {
  word: Word;
  inSrs: boolean;
  onToggle: () => void;
  isPending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const posLabel = POS_LABELS[w.pos] ?? w.pos;

  return (
    <div className="rounded-xl border-2 border-lingo-border bg-lingo-card hover:border-lingo-gray-dark transition-colors">
      <div
        className="flex items-center gap-2 p-4 cursor-pointer"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="text-base font-black text-lingo-text truncate">
              {w.word}
              {w.gender && (
                <span className="ml-1 text-xs font-bold text-lingo-text-light">
                  ({w.gender})
                </span>
              )}
            </span>
            <span className="text-sm text-lingo-text-light truncate">
              {w.english_translation}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {posLabel && (
            <span className="rounded-md bg-lingo-gray/60 px-2 py-0.5 text-xs font-bold text-lingo-text-light">
              {posLabel}
            </span>
          )}
          <span
            className={`rounded-md px-2 py-0.5 text-xs font-bold ${LEVEL_COLORS[w.cefr_level] ?? "bg-lingo-gray text-lingo-text"}`}
          >
            {w.cefr_level}
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            disabled={isPending}
            className={`ml-1 rounded-lg px-2 py-1 text-xs font-bold transition-colors disabled:opacity-50 ${
              inSrs
                ? "bg-lingo-green/10 text-lingo-green hover:bg-lingo-red/10 hover:text-lingo-red"
                : "bg-lingo-gray/60 text-lingo-text-light hover:bg-lingo-green/10 hover:text-lingo-green"
            }`}
            title={inSrs ? "Remove from My Words" : "Add to My Words"}
          >
            {inSrs ? "✓" : "+"}
          </button>
        </div>
      </div>

      {expanded && w.example_sentence_native && (
        <div className="mx-4 mb-4 border-t border-lingo-border pt-3 text-sm">
          <p className="font-bold text-lingo-text">
            {w.example_sentence_native}
          </p>
          <p className="text-lingo-text-light mt-0.5">
            {w.example_sentence_english}
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── My Words Tab ─── */

function MyWordsTab({
  srsCards,
  srsStats,
  language,
}: {
  srsCards: SrsCard[];
  srsStats: SrsStats;
  language: string;
}) {
  const [filter, setFilter] = useState<SrsFilter>("all");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const now = useMemo(() => new Date(), []);

  const filtered = useMemo(() => {
    let cards = srsCards;

    // Apply SRS filter
    switch (filter) {
      case "due":
        cards = cards.filter((c) => new Date(c.nextReviewAt) <= now);
        break;
      case "new":
        cards = cards.filter((c) => c.repetitions === 0);
        break;
      case "learning":
        cards = cards.filter((c) => c.repetitions > 0 && c.repetitions < 3);
        break;
      case "learned":
        cards = cards.filter((c) => c.repetitions >= 3);
        break;
    }

    // Apply search
    const q = search.toLowerCase().trim();
    if (q) {
      cards = cards.filter(
        (c) =>
          c.word.includes(q) || c.translation.toLowerCase().includes(q)
      );
    }

    return cards;
  }, [srsCards, filter, search, now]);

  const visible = filtered.slice(0, visibleCount);
  const hasMore = visibleCount < filtered.length;

  function handleRemove(card: SrsCard) {
    startTransition(async () => {
      await removeWordFromSrs(card.word, language);
      router.refresh();
    });
  }

  function handleRemoveAll() {
    if (!confirm(`Delete all ${srsStats.total} saved words? This cannot be undone.`)) return;
    startTransition(async () => {
      await removeAllWordsFromSrs(language);
      router.refresh();
    });
  }

  const filters: { key: SrsFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: srsStats.total },
    { key: "due", label: "Due", count: srsStats.due },
    {
      key: "new",
      label: "New",
      count: srsCards.filter((c) => c.repetitions === 0).length,
    },
    {
      key: "learning",
      label: "Learning",
      count: srsCards.filter((c) => c.repetitions > 0 && c.repetitions < 3)
        .length,
    },
    { key: "learned", label: "Learned", count: srsStats.learned },
  ];

  return (
    <div>
      {/* Stats bar */}
      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-xl border-2 border-lingo-border bg-lingo-card p-3 text-center">
          <p className="text-lg font-black text-lingo-blue">{srsStats.total}</p>
          <p className="text-xs font-bold text-lingo-text-light">Total</p>
        </div>
        <div className="rounded-xl border-2 border-lingo-border bg-lingo-card p-3 text-center">
          <p className="text-lg font-black text-lingo-orange">{srsStats.due}</p>
          <p className="text-xs font-bold text-lingo-text-light">Due</p>
        </div>
        <div className="rounded-xl border-2 border-lingo-border bg-lingo-card p-3 text-center">
          <p className="text-lg font-black text-lingo-green">{srsStats.learned}</p>
          <p className="text-xs font-bold text-lingo-text-light">Learned</p>
        </div>
      </div>

      {/* Delete all */}
      {srsCards.length > 0 && (
        <button
          onClick={handleRemoveAll}
          disabled={isPending}
          className="mb-4 w-full rounded-xl border-2 border-lingo-red/30 py-3 text-sm font-bold text-lingo-red hover:bg-lingo-red/10 transition-colors disabled:opacity-50"
        >
          {isPending ? "Deleting..." : "Delete All Words"}
        </button>
      )}

      {/* Filter pills */}
      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => {
              setFilter(f.key);
              setVisibleCount(PAGE_SIZE);
            }}
            className={`rounded-full px-4 py-1.5 text-sm font-bold transition-all ${
              filter === f.key
                ? "bg-lingo-blue text-white"
                : "bg-lingo-card border-2 border-lingo-border text-lingo-text hover:border-lingo-gray-dark"
            }`}
          >
            {f.label}
            <span
              className={`ml-1.5 text-xs ${filter === f.key ? "opacity-80" : "text-lingo-text-light"}`}
            >
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search my words..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setVisibleCount(PAGE_SIZE);
          }}
          className="w-full rounded-xl border-2 border-lingo-border bg-lingo-card px-4 py-2.5 text-sm font-bold text-lingo-text placeholder:text-lingo-text-light/60 focus:border-lingo-blue focus:outline-none"
        />
      </div>

      {/* Results count */}
      <p className="mb-3 text-xs font-bold text-lingo-text-light">
        {filtered.length.toLocaleString()} word
        {filtered.length !== 1 ? "s" : ""}
        {filter !== "all" && ` (${filter})`}
      </p>

      {/* Empty state */}
      {srsCards.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-lg font-bold text-lingo-text">No words yet</p>
          <p className="mt-1 text-sm text-lingo-text-light">
            Switch to &quot;All Words&quot; and add words to start learning
          </p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-lingo-text-light">
          No words match this filter.
        </p>
      ) : (
        <div className="space-y-2">
          {visible.map((card) => (
            <SrsCardRow
              key={`${card.word}-${card.language}`}
              card={card}
              now={now}
              onRemove={() => handleRemove(card)}
              isPending={isPending}
            />
          ))}
        </div>
      )}

      {/* Load more */}
      {hasMore && (
        <button
          onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          className="mt-4 w-full rounded-xl border-2 border-lingo-border bg-lingo-card py-3 text-sm font-bold text-lingo-text-light hover:border-lingo-gray-dark hover:text-lingo-text transition-colors"
        >
          Show more ({Math.min(PAGE_SIZE, filtered.length - visibleCount)} of{" "}
          {(filtered.length - visibleCount).toLocaleString()} remaining)
        </button>
      )}
    </div>
  );
}

function SrsCardRow({
  card,
  now,
  onRemove,
  isPending,
}: {
  card: SrsCard;
  now: Date;
  onRemove: () => void;
  isPending: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  const nextReview = new Date(card.nextReviewAt);
  const isDue = nextReview <= now;
  const status = getCardStatus(card);
  const statusStyle = STATUS_STYLES[status];

  return (
    <div className="rounded-xl border-2 border-lingo-border bg-lingo-card hover:border-lingo-gray-dark transition-colors">
      <div
        className="flex items-center gap-2 p-4 cursor-pointer"
        onClick={() => setExpanded((e) => !e)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3">
            <span className="text-base font-black text-lingo-text truncate">
              {card.word}
            </span>
            <span className="text-sm text-lingo-text-light truncate">
              {card.translation}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isDue && (
            <span className="rounded-md bg-lingo-orange/15 px-2 py-0.5 text-xs font-bold text-lingo-orange">
              Due
            </span>
          )}
          <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${statusStyle}`}>
            {status}
          </span>
        </div>
      </div>

      {expanded && (
        <div className="mx-4 mb-4 border-t border-lingo-border pt-3">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
            <div>
              <span className="font-bold text-lingo-text-light">Interval</span>
              <span className="ml-2 font-bold text-lingo-text">
                {formatInterval(card.interval)}
              </span>
            </div>
            <div>
              <span className="font-bold text-lingo-text-light">Reviews</span>
              <span className="ml-2 font-bold text-lingo-text">
                {card.repetitions}
              </span>
            </div>
            <div>
              <span className="font-bold text-lingo-text-light">Ease</span>
              <span className="ml-2 font-bold text-lingo-text">
                {(card.easeFactor * 100).toFixed(0)}%
              </span>
            </div>
            <div>
              <span className="font-bold text-lingo-text-light">Next</span>
              <span className="ml-2 font-bold text-lingo-text">
                {isDue ? "Now" : formatRelativeDate(nextReview, now)}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mt-3 h-1.5 rounded-full bg-lingo-gray/60 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${
                card.repetitions >= 3
                  ? "bg-lingo-green"
                  : card.repetitions > 0
                    ? "bg-lingo-blue"
                    : "bg-lingo-gray-dark"
              }`}
              style={{ width: `${Math.min(100, (card.repetitions / 5) * 100)}%` }}
            />
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            disabled={isPending}
            className="mt-3 rounded-lg px-3 py-1.5 text-xs font-bold text-lingo-red hover:bg-lingo-red/10 transition-colors disabled:opacity-50"
          >
            Remove
          </button>
        </div>
      )}
    </div>
  );
}

/* ─── Helpers ─── */

function getCardStatus(card: SrsCard): string {
  if (card.repetitions === 0) return "New";
  if (card.repetitions < 3) return "Learning";
  return "Learned";
}

const STATUS_STYLES: Record<string, string> = {
  New: "bg-lingo-gray/60 text-lingo-text-light",
  Learning: "bg-lingo-blue/15 text-lingo-blue",
  Learned: "bg-lingo-green/15 text-lingo-green-dark",
};

function formatInterval(days: number): string {
  if (days === 0) return "New";
  if (days === 1) return "1 day";
  if (days < 30) return `${days} days`;
  if (days < 365) return `${Math.round(days / 30)} mo`;
  return `${(days / 365).toFixed(1)} yr`;
}

function formatRelativeDate(date: Date, now: Date): string {
  const diff = date.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return "Now";
  if (days === 1) return "Tomorrow";
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}yr`;
}
