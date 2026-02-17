"use client";

import { useState, useCallback } from "react";
import { WordPopover } from "./word-popover";
import { useAudio } from "@/hooks/use-audio";

interface HoverableTextProps {
  text: string;
  language: string;
  as?: "p" | "span" | "h2";
  className?: string;
  noAudio?: boolean;
}

interface ActiveWord {
  word: string;
  rect: DOMRect;
}

interface TextSegment {
  text: string;
  bold?: boolean;
  italic?: boolean;
}

/** Parse basic inline markdown (**bold**, *italic*) into segments */
function parseInlineMarkdown(text: string): TextSegment[] {
  const segments: TextSegment[] = [];
  const regex = /(\*\*\*(.+?)\*\*\*|\*\*(.+?)\*\*|\*(.+?)\*)/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // Plain text before this match
    if (match.index > lastIndex) {
      segments.push({ text: text.slice(lastIndex, match.index) });
    }
    if (match[2]) {
      // ***bold-italic***
      segments.push({ text: match[2], bold: true, italic: true });
    } else if (match[3]) {
      // **bold**
      segments.push({ text: match[3], bold: true });
    } else if (match[4]) {
      // *italic*
      segments.push({ text: match[4], italic: true });
    }
    lastIndex = match.index + match[0].length;
  }

  // Remaining plain text
  if (lastIndex < text.length) {
    segments.push({ text: text.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ text }];
}

export function HoverableText({
  text,
  language,
  as: Tag = "span",
  className,
  noAudio,
}: HoverableTextProps) {
  const [active, setActive] = useState<ActiveWord | null>(null);
  const { play } = useAudio();

  const handleWordClick = useCallback(
    (e: React.MouseEvent<HTMLSpanElement>, word: string) => {
      e.stopPropagation();
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      setActive({ word, rect });
      if (!noAudio) play(word, language);
    },
    [play, language, noAudio]
  );

  function renderWords(str: string, keyPrefix: string) {
    const words = str.split(/(\s+)/);
    return words.map((segment, i) => {
      if (/^\s+$/.test(segment)) {
        return <span key={`${keyPrefix}-${i}`}>{segment}</span>;
      }
      const cleanWord = segment.replace(/[^\p{L}\p{M}'-]/gu, "");
      if (!cleanWord) {
        return <span key={`${keyPrefix}-${i}`}>{segment}</span>;
      }
      return (
        <span
          key={`${keyPrefix}-${i}`}
          onClick={(e) => handleWordClick(e, cleanWord)}
          className="cursor-pointer rounded-sm transition-colors hover:bg-lingo-blue/10 hover:text-lingo-blue"
        >
          {segment}
        </span>
      );
    });
  }

  const mdSegments = parseInlineMarkdown(text);

  return (
    <>
      <Tag className={className}>
        {mdSegments.map((seg, si) => {
          const inner = renderWords(seg.text, `s${si}`);
          if (seg.bold && seg.italic) return <strong key={si}><em>{inner}</em></strong>;
          if (seg.bold) return <strong key={si}>{inner}</strong>;
          if (seg.italic) return <em key={si}>{inner}</em>;
          return <span key={si}>{inner}</span>;
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
