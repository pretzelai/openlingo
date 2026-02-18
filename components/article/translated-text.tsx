"use client";

import { useState, useEffect, useCallback } from "react";
import { useIsMobile } from "@/hooks/use-media-query";
import { WordPopover } from "@/components/word/word-popover";
import { ViewModeToggle, type ViewMode } from "./view-mode-toggle";
import type { TranslationBlock } from "@/lib/article/types";

interface TranslatedTextProps {
  blocks: TranslationBlock[];
  targetLanguage: string;
}

function WordSpan({
  word,
  display,
  language,
}: {
  word: string;
  display: string;
  language: string;
}) {
  const [popover, setPopover] = useState<{
    word: string;
    rect: DOMRect;
  } | null>(null);

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
        className="cursor-pointer rounded-sm px-0.5 -mx-0.5 transition-colors duration-150 hover:bg-lingo-blue/15 hover:text-lingo-blue active:bg-lingo-blue/15 active:text-lingo-blue"
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

function ParagraphText({
  text,
  language,
}: {
  text: string;
  language: string;
}) {
  const words = text.split(/(\s+)/);

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
        return (
          <WordSpan
            key={i}
            word={cleanWord}
            display={segment}
            language={language}
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
}: {
  block: TranslationBlock;
  language: string;
  viewMode: ViewMode;
}) {
  const translatedParagraphs = block.translated
    .split(/\n\n+/)
    .filter((p) => p.trim());
  const bridgeParagraphs =
    block.bridge
      ?.split(/\n\n+/)
      .filter((p) => p.trim()) || [];

  return (
    <div>
      <div className={viewMode === "target" ? "block" : "hidden"}>
        {translatedParagraphs.map((paragraph, i) => (
          <ParagraphText key={i} text={paragraph} language={language} />
        ))}
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
}: TranslatedTextProps) {
  const [viewMode, setViewMode] = useState<ViewMode>("target");
  const isMobile = useIsMobile();

  const hasBridge = blocks.some(
    (block) => block.bridge && block.bridge.length > 0,
  );

  // Map language code to display name for the language param used in word lookup
  // The targetLanguage stored in articles is the full name (e.g., "German")
  // but word lookup API needs the code (e.g., "de")
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
        />
      ))}
    </div>
  );
}
