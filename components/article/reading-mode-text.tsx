"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import type { WordTimestamp } from "@/lib/audio/align-timestamps";
import { WordPopover } from "@/components/word/word-popover";

interface ReadingModeTextProps {
  timestamps: WordTimestamp[];
  currentWordIndex: number;
  onWordClick: (index: number) => void;
  onTooltipClose: () => void;
  language: string;
  isPlaying: boolean;
}

export function ReadingModeText({
  timestamps,
  currentWordIndex,
  onWordClick,
  onTooltipClose,
  language,
  isPlaying,
}: ReadingModeTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const currentWordRef = useRef<HTMLSpanElement>(null);
  const [selectedWord, setSelectedWord] = useState<{
    index: number;
    rect: DOMRect;
  } | null>(null);

  // Auto-scroll to keep current word visible
  useEffect(() => {
    if (currentWordRef.current && containerRef.current) {
      const container = containerRef.current;
      const word = currentWordRef.current;
      const containerRect = container.getBoundingClientRect();
      const wordRect = word.getBoundingClientRect();
      const isAbove = wordRect.top < containerRect.top + 100;
      const isBelow = wordRect.bottom > containerRect.bottom - 100;
      if (isAbove || isBelow) {
        word.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [currentWordIndex]);

  const handleWordClick = useCallback(
    (absoluteIndex: number, e: React.MouseEvent<HTMLSpanElement>) => {
      onWordClick(absoluteIndex);
      const rect = e.currentTarget.getBoundingClientRect();
      setSelectedWord({ index: absoluteIndex, rect });
    },
    [onWordClick],
  );

  // Close tooltip when audio resumes
  useEffect(() => {
    if (isPlaying && selectedWord) {
      setSelectedWord(null);
    }
  }, [isPlaying, selectedWord]);

  // Sentence range for context display
  const getSentenceRange = useCallback(
    (
      wordIndex: number,
    ): { start: number; end: number } => {
      let start = wordIndex;
      while (start > 0) {
        const prevWord = timestamps[start - 1]?.word || "";
        if (
          prevWord.endsWith(".") ||
          prevWord.endsWith("!") ||
          prevWord.endsWith("?")
        )
          break;
        start--;
      }
      let end = wordIndex;
      while (end < timestamps.length - 1) {
        const word = timestamps[end]?.word || "";
        if (
          word.endsWith(".") ||
          word.endsWith("!") ||
          word.endsWith("?")
        ) {
          end++;
          break;
        }
        end++;
      }
      const maxContext = 25;
      if (wordIndex - start > maxContext) start = wordIndex - maxContext;
      if (end - wordIndex > maxContext) end = wordIndex + maxContext;
      return { start, end };
    },
    [timestamps],
  );

  const { start: sentenceStart, end: sentenceEnd } =
    getSentenceRange(currentWordIndex);
  const visibleWords = timestamps.slice(sentenceStart, sentenceEnd);

  return (
    <>
      <div
        ref={containerRef}
        className="flex-1 overflow-y-auto px-4 sm:px-8 py-8 flex items-center"
      >
        <div className="w-full max-w-xl mx-auto">
          <p className="text-center leading-loose break-words text-lg sm:text-xl text-lingo-text">
            {visibleWords.map((wordTs, localIndex) => {
              const absoluteIndex = sentenceStart + localIndex;
              const isCurrent = absoluteIndex === currentWordIndex;
              const isPast = absoluteIndex < currentWordIndex;

              return (
                <span key={absoluteIndex}>
                  <span
                    ref={isCurrent ? currentWordRef : undefined}
                    onClick={(e) => handleWordClick(absoluteIndex, e)}
                    className={`cursor-pointer transition-all duration-150 select-none rounded-sm ${
                      isCurrent
                        ? "font-medium text-lingo-text bg-lingo-blue/15 shadow-[0_0_0_3px_rgba(var(--lingo-blue-rgb,28,176,246),0.15)]"
                        : isPast
                          ? "text-lingo-text-light"
                          : "text-lingo-text/70 hover:text-lingo-text hover:bg-lingo-gray/40"
                    }`}
                  >
                    {wordTs.word}
                  </span>
                  {localIndex < visibleWords.length - 1 && " "}
                </span>
              );
            })}
          </p>

          <p className="text-center text-lingo-text-light text-sm mt-8">
            Word {currentWordIndex + 1} of {timestamps.length}
          </p>
        </div>
      </div>

      {/* Word popover */}
      {selectedWord && timestamps[selectedWord.index] && (
        <WordPopover
          word={timestamps[selectedWord.index].word.replace(
            /[^\p{L}\p{M}'-]/gu,
            "",
          )}
          language={language}
          anchorRect={selectedWord.rect}
          onClose={() => {
            setSelectedWord(null);
            onTooltipClose();
          }}
        />
      )}
    </>
  );
}
