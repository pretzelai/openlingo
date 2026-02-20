import { parseHTML } from "linkedom";
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
    const { document, window } = parseHTML(html);
    // Keep URL context for parsers that use document.location/baseURI.
    try {
      window.location.href = url;
    } catch {
      // Ignore location assignment issues; extraction can still proceed.
    }

    const reader = new Readability(document);
    const article = reader.parse();
    const parsedContent = article?.textContent?.trim() ?? "";
    if (parsedContent.length >= 100) {
      return { title: article?.title || "Untitled", content: parsedContent };
    }

    // Fallback for pages where Readability returns null/very short content.
    const fallback = fallbackExtractPlainText(html);
    if (!fallback || fallback.content.length < 100) return null;
    return fallback;
  } catch (error) {
    console.error("Readability extraction failed, using fallback:", error);
    const fallback = fallbackExtractPlainText(html);
    return fallback && fallback.content.length >= 100 ? fallback : null;
  }
}

function fallbackExtractPlainText(
  html: string,
): { title: string; content: string } | null {
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const title = titleMatch?.[1]?.trim() || "Untitled";

  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ");

  const content = withoutNoise
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/\s+/g, " ")
    .trim();

  if (!content) return null;
  return { title, content };
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
