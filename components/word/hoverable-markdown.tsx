"use client";

import { useState, useCallback, Children, isValidElement, ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import { WordPopover } from "./word-popover";
import { useAudio } from "@/hooks/use-audio";

interface ActiveWord {
  word: string;
  rect: DOMRect;
}

interface HoverableMarkdownProps {
  text: string;
  language: string;
}

export function HoverableMarkdown({ text, language }: HoverableMarkdownProps) {
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

  /** Recursively walk React children, replacing text strings with hoverable word spans */
  function makeHoverable(children: ReactNode, prefix: string): ReactNode {
    return Children.map(children, (child, i) => {
      if (typeof child === "string") {
        return renderWords(child, `${prefix}-${i}`);
      }
      if (isValidElement(child) && child.props) {
        // Skip code blocks — not natural language
        const tag = child.type;
        if (tag === "code" || tag === "pre") return child;

        const { children: nested, ...rest } = child.props as { children?: ReactNode; [k: string]: unknown };
        if (nested === undefined) return child;
        return { ...child, props: { ...rest, children: makeHoverable(nested, `${prefix}-${i}`) } };
      }
      return child;
    });
  }

  return (
    <>
      <ReactMarkdown
        components={{
          p: ({ children, ...props }) => <p {...props}>{makeHoverable(children, "p")}</p>,
          li: ({ children, ...props }) => <li {...props}>{makeHoverable(children, "li")}</li>,
          h1: ({ children, ...props }) => <h1 {...props}>{makeHoverable(children, "h1")}</h1>,
          h2: ({ children, ...props }) => <h2 {...props}>{makeHoverable(children, "h2")}</h2>,
          h3: ({ children, ...props }) => <h3 {...props}>{makeHoverable(children, "h3")}</h3>,
          h4: ({ children, ...props }) => <h4 {...props}>{makeHoverable(children, "h4")}</h4>,
          strong: ({ children, ...props }) => <strong {...props}>{makeHoverable(children, "strong")}</strong>,
          em: ({ children, ...props }) => <em {...props}>{makeHoverable(children, "em")}</em>,
          td: ({ children, ...props }) => <td {...props}>{makeHoverable(children, "td")}</td>,
          th: ({ children, ...props }) => <th {...props}>{makeHoverable(children, "th")}</th>,
          blockquote: ({ children, ...props }) => <blockquote {...props}>{makeHoverable(children, "bq")}</blockquote>,
        }}
      >
        {text}
      </ReactMarkdown>

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
