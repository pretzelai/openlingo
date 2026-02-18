"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useIsMobile } from "@/hooks/use-media-query";
import { WordPopover } from "@/components/word/word-popover";
import { ViewModeToggle, type ViewMode } from "./view-mode-toggle";
import type { TranslationBlock } from "@/lib/article/types";
import {
  findWordAtTime,
  type WordTimestamp,
} from "@/lib/audio/align-timestamps";

interface TranslatedTextProps {
  blocks: TranslationBlock[];
  targetLanguage: string;
  timestamps?: WordTimestamp[] | null;
  currentAudioTime?: number;
  isAudioPlaying?: boolean;
}

function WordSpan({
  word,
  display,
  language,
  isHighlighted,
}: {
  word: string;
  display: string;
  language: string;
  isHighlighted?: boolean;
}) {
  const [popover, setPopover] = useState<{
    word: string;
    rect: DOMRect;
  } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);

  // Auto-scroll highlighted word into view
  useEffect(() => {
    if (isHighlighted && ref.current) {
      const el = ref.current;
      const rect = el.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      // Scroll if word is outside the middle 60% of viewport
      if (rect.top < viewportHeight * 0.2 || rect.bottom > viewportHeight * 0.7) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }
  }, [isHighlighted]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLSpanElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setPopover({ word, rect });
    },
    [word],
  );

  return (
    <>
      <span
        ref={ref}
        className={`cursor-pointer rounded-sm px-0.5 -mx-0.5 transition-colors duration-150 ${
          isHighlighted
            ? "bg-lingo-blue/20 text-lingo-blue"
            : "hover:bg-lingo-blue/15 hover:text-lingo-blue active:bg-lingo-blue/15 active:text-lingo-blue"
        }`}
        onClick={handleClick}
      >
        {display}
      </span>
      {popover && (
        <WordPopover
          word={popover.word}
          language={language}
          anchorRect={popover.rect}
          onClose={() => setPopover(null)}
        />
      )}
    </>
  );
}

/** Count words in text using the same splitting as timestamps (\S+) */
function countWords(text: string): number {
  const matches = text.match(/\S+/g);
  return matches ? matches.length : 0;
}

function ParagraphText({
  text,
  language,
  highlightWordIndex,
}: {
  text: string;
  language: string;
  highlightWordIndex?: number;
}) {
  const words = text.split(/(\s+)/);
  let wordCounter = 0;

  return (
    <p className="text-lg leading-relaxed text-lingo-text mb-6">
      {words.map((segment, i) => {
        if (/^\s+$/.test(segment)) {
          return <span key={i}>{segment}</span>;
        }
        const cleanWord = segment.replace(/[^\p{L}\p{M}'-]/gu, "");
        if (!cleanWord) {
          return <span key={i}>{segment}</span>;
        }
        const currentWordIdx = wordCounter;
        wordCounter++;
        return (
          <WordSpan
            key={i}
            word={cleanWord}
            display={segment}
            language={language}
            isHighlighted={
              highlightWordIndex !== undefined &&
              currentWordIdx === highlightWordIndex
            }
          />
        );
      })}
    </p>
  );
}

function TranslationChunk({
  block,
  language,
  viewMode,
  blockWordOffset,
  highlightFlatIndex,
}: {
  block: TranslationBlock;
  language: string;
  viewMode: ViewMode;
  blockWordOffset: number;
  highlightFlatIndex?: number;
}) {
  const translatedParagraphs = useMemo(
    () => block.translated.split(/\n\n+/).filter((p) => p.trim()),
    [block.translated],
  );
  const bridgeParagraphs =
    block.bridge
      ?.split(/\n\n+/)
      .filter((p) => p.trim()) || [];

  // Precompute per-paragraph word offsets within this block
  const paragraphWordOffsets = useMemo(() => {
    const offsets: number[] = [];
    let cumulative = 0;
    for (const p of translatedParagraphs) {
      offsets.push(cumulative);
      cumulative += countWords(p);
    }
    return offsets;
  }, [translatedParagraphs]);

  return (
    <div>
      <div className={viewMode === "target" ? "block" : "hidden"}>
        {translatedParagraphs.map((paragraph, i) => {
          // Compute highlight index relative to this paragraph
          let highlightLocal: number | undefined;
          if (highlightFlatIndex !== undefined) {
            const localInBlock = highlightFlatIndex - blockWordOffset;
            const localInParagraph = localInBlock - paragraphWordOffsets[i];
            if (
              localInParagraph >= 0 &&
              localInParagraph < countWords(paragraph)
            ) {
              highlightLocal = localInParagraph;
            }
          }

          return (
            <ParagraphText
              key={i}
              text={paragraph}
              language={language}
              highlightWordIndex={highlightLocal}
            />
          );
        })}
      </div>
      <div className={viewMode === "bridge" ? "block" : "hidden"}>
        {bridgeParagraphs.length > 0 ? (
          bridgeParagraphs.map((paragraph, i) => (
            <p
              key={i}
              className="text-lg leading-relaxed text-lingo-text-light mb-6"
            >
              {paragraph}
            </p>
          ))
        ) : (
          <p className="text-lg leading-relaxed text-lingo-text-light italic mb-6">
            English translation not available for this section.
          </p>
        )}
      </div>
      <div className={viewMode === "source" ? "block" : "hidden"}>
        {block.original
          .split(/\n\n+/)
          .filter((p) => p.trim())
          .map((paragraph, i) => (
            <p
              key={i}
              className="text-lg leading-relaxed text-lingo-text-light italic mb-6"
            >
              {paragraph}
            </p>
          ))}
      </div>
    </div>
  );
}

export function TranslatedText({
  blocks,
  targetLanguage,
  timestamps,
  currentAudioTime,
  isAudioPlaying,
}: TranslatedTextProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("target");
  const isMobile = useIsMobile();

  const hasBridge = blocks.some(
    (block) => block.bridge && block.bridge.length > 0,
  );

  // Map language code to display name for the language param used in word lookup
  const langCodeMap: Record<string, string> = {
    german: "de",
    french: "fr",
    spanish: "es",
    italian: "it",
    portuguese: "pt",
    russian: "ru",
    arabic: "ar",
    hindi: "hi",
    korean: "ko",
    mandarin: "zh",
    japanese: "ja",
    english: "en",
  };
  const langCode =
    langCodeMap[targetLanguage.toLowerCase()] || targetLanguage.toLowerCase();

  // Compute per-block word offsets (flat index into the timestamps array)
  const blockWordOffsets = useMemo(() => {
    const offsets: number[] = [];
    let cumulative = 0;
    for (const block of blocks) {
      offsets.push(cumulative);
      cumulative += countWords(block.translated);
    }
    return offsets;
  }, [blocks]);

  // Compute current highlighted word flat index
  const highlightFlatIndex = useMemo(() => {
    if (
      !timestamps ||
      timestamps.length === 0 ||
      currentAudioTime === undefined ||
      !isAudioPlaying
    ) {
      return undefined;
    }
    return findWordAtTime(timestamps, currentAudioTime);
  }, [timestamps, currentAudioTime, isAudioPlaying]);

  // Desktop: Cmd/Ctrl key for quick view switching
  useEffect(() => {
    if (isMobile) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Meta" || e.key === "Control") {
        if (e.shiftKey) {
          setViewMode("source");
        } else if (hasBridge) {
          setViewMode("bridge");
        } else {
          setViewMode("source");
        }
      } else if (e.key === "Shift" && (e.metaKey || e.ctrlKey)) {
        setViewMode("source");
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === "Meta" || e.key === "Control") {
        setViewMode("target");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isMobile, hasBridge]);

  return (
    <div>
      {/* View mode toggle */}
      <div className="sticky top-0 z-10 flex justify-center py-3 bg-lingo-bg/80 backdrop-blur-sm">
        <ViewModeToggle
          mode={viewMode}
          onModeChange={setViewMode}
          targetLanguage={targetLanguage}
          hasBridge={hasBridge}
        />
      </div>

      {/* Keyboard hint (desktop only) */}
      {!isMobile && (
        <p className="text-center text-xs text-lingo-text-light mb-6">
          Hold <kbd className="rounded border border-lingo-border px-1 py-0.5 text-[10px]">Cmd</kbd> for English
          {" "}· Hold <kbd className="rounded border border-lingo-border px-1 py-0.5 text-[10px]">Cmd+Shift</kbd> for Source
        </p>
      )}

      {/* Translation blocks */}
      {blocks.map((block, index) => (
        <TranslationChunk
          key={index}
          block={block}
          language={langCode}
          viewMode={viewMode}
          blockWordOffset={blockWordOffsets[index]}
          highlightFlatIndex={highlightFlatIndex}
        />
      ))}
    </div>
  );
}
