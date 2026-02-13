"use client";

import { useState, useCallback } from "react";
import { WordPopover } from "./word-popover";
import { useAudio } from "@/hooks/use-audio";

interface HoverableTextProps {
  text: string;
  language: string;
  as?: "p" | "span" | "h2";
  className?: string;
}

interface ActiveWord {
  word: string;
  rect: DOMRect;
}

export function HoverableText({
  text,
  language,
  as: Tag = "span",
  className,
}: HoverableTextProps) {
  const [active, setActive] = useState<ActiveWord | null>(null);
  const { play } = useAudio();

  const handleWordClick = useCallback(
    (e: React.MouseEvent<HTMLSpanElement>, word: string) => {
      e.stopPropagation();
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      setActive({ word, rect });
      play(word, language);
    },
    [play, language]
  );

  const segments = text.split(/(\s+)/);

  return (
    <>
      <Tag className={className}>
        {segments.map((segment, i) => {
          // Whitespace segments — render as-is
          if (/^\s+$/.test(segment)) {
            return <span key={i}>{segment}</span>;
          }
          // Extract clean word (letters only)
          const cleanWord = segment.replace(/[^\p{L}\p{M}'-]/gu, "");
          if (!cleanWord) {
            return <span key={i}>{segment}</span>;
          }
          return (
            <span
              key={i}
              onClick={(e) => handleWordClick(e, cleanWord)}
              className="cursor-pointer rounded-sm transition-colors hover:bg-lingo-blue/10 hover:text-lingo-blue"
            >
              {segment}
            </span>
          );
        })}
      </Tag>

      {active && (
        <WordPopover
          word={active.word}
          language={language}
          anchorRect={active.rect}
          onClose={() => setActive(null)}
        />
      )}
    </>
  );
}
