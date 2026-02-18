import { JSDOM } from "jsdom";
import { Readability } from "@mozilla/readability";

// Site-specific configurations
interface SiteConfig {
  patterns: string[];
  noChunk?: boolean;
  skipReadability?: boolean;
  returnCleanOriginal?: boolean;
}

const SITE_CONFIGS: SiteConfig[] = [
  {
    patterns: ["lemonde.fr"],
    noChunk: true,
    skipReadability: true,
    returnCleanOriginal: true,
  },
];

export function getSiteConfig(url: string): SiteConfig | null {
  try {
    const hostname = new URL(url).hostname.toLowerCase();
    return (
      SITE_CONFIGS.find((config) =>
        config.patterns.some((pattern) => hostname.includes(pattern)),
      ) || null
    );
  } catch {
    return null;
  }
}

export function extractArticleContent(
  html: string,
  url: string,
): { title: string; content: string } | null {
  try {
    const dom = new JSDOM(html, { url });
    const reader = new Readability(dom.window.document);
    const article = reader.parse();
    if (!article) return null;
    const content = article.textContent || "";
    return { title: article.title || "Untitled", content };
  } catch (error) {
    console.error("Readability extraction failed:", error);
    return null;
  }
}

const CHUNK_CONFIG = {
  MIN_WORDS: 50,
  TARGET_WORDS: 250,
  MAX_WORDS: 500,
};

export function countWords(text: string): number {
  return text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0).length;
}

function splitAtSentences(text: string, maxWords: number): string[] {
  const normalizedText = text
    .replace(/([.!?])([A-Z])/g, "$1 $2")
    .replace(/([.!?])(["'])([A-Z])/g, "$1$2 $3");

  const sentencePattern = /[^.!?]*[.!?]+[\s]*/g;
  const matches: string[] = normalizedText.match(sentencePattern) || [];

  const matchedLength = matches.join("").length;
  if (matchedLength < normalizedText.length) {
    const remaining = normalizedText.slice(matchedLength).trim();
    if (remaining) matches.push(remaining);
  }

  const sentences = matches.length > 0 ? matches : [text];

  const chunks: string[] = [];
  let current = "";
  let currentWords = 0;

  for (const sentence of sentences) {
    const sentenceWords = countWords(sentence);
    if (currentWords + sentenceWords <= maxWords) {
      current += sentence;
      currentWords += sentenceWords;
    } else {
      if (current.trim()) chunks.push(current.trim());
      current = sentence;
      currentWords = sentenceWords;
    }
  }
  if (current.trim()) chunks.push(current.trim());

  return chunks;
}

export function smartChunkContent(content: string): string[] {
  const { MIN_WORDS, TARGET_WORDS, MAX_WORDS } = CHUNK_CONFIG;

  let segments = content
    .split(/\n\n+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  if (segments.length <= 1 && countWords(content) > MAX_WORDS) {
    segments = content
      .split(/\n+/)
      .map((p) => p.trim())
      .filter((p) => p.length > 0);
  }

  segments = segments.flatMap((segment) => {
    if (countWords(segment) <= MAX_WORDS) return [segment];
    return splitAtSentences(segment, TARGET_WORDS);
  });

  const merged: string[] = [];
  let buffer = "";
  let bufferWords = 0;

  for (const segment of segments) {
    const segmentWords = countWords(segment);

    if (buffer.length === 0) {
      buffer = segment;
      bufferWords = segmentWords;
      continue;
    }

    const shouldMerge =
      bufferWords < MIN_WORDS ||
      segmentWords < MIN_WORDS ||
      (bufferWords < TARGET_WORDS &&
        segmentWords < TARGET_WORDS &&
        bufferWords + segmentWords <= MAX_WORDS);

    if (shouldMerge && bufferWords + segmentWords <= MAX_WORDS) {
      buffer = buffer + "\n\n" + segment;
      bufferWords += segmentWords;
    } else {
      if (buffer.trim()) merged.push(buffer.trim());
      buffer = segment;
      bufferWords = segmentWords;
    }
  }
  if (buffer.trim()) merged.push(buffer.trim());

  if (merged.length > 1) {
    const lastChunk = merged[merged.length - 1];
    const lastWords = countWords(lastChunk);
    if (lastWords < MIN_WORDS) {
      const secondLast = merged[merged.length - 2];
      const secondLastWords = countWords(secondLast);
      if (secondLastWords + lastWords <= MAX_WORDS) {
        merged[merged.length - 2] = secondLast + "\n\n" + lastChunk;
        merged.pop();
      }
    }
  }

  return merged.filter((chunk) => chunk.trim().length > 0);
}
