import { GoogleGenAI } from "@google/genai";
import { getCefrGuidelines } from "./cefr-guidelines";
import type { TranslationBlock } from "./types";

let geminiClient: GoogleGenAI | null = null;
function getGemini() {
  if (!geminiClient && process.env.GOOGLE_AI_API_KEY) {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });
  }
  return geminiClient;
}

export async function detectLanguage(text: string): Promise<string> {
  const gemini = getGemini();
  if (!gemini) return "Unknown";

  const sample = text.slice(0, 500);
  const prompt = `Detect the language of the following text. Return ONLY the language name in English (e.g., "German", "French", "Spanish"). No explanation, just the language name.\n\nText:\n${sample}`;

  try {
    const response = await gemini.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: { thinkingConfig: { thinkingBudget: 0 } },
    });

    const detected = response.text?.trim();
    if (detected) {
      const normalized = detected.replace(/[^a-zA-Z]/g, "");
      return (
        normalized.charAt(0).toUpperCase() + normalized.slice(1).toLowerCase()
      );
    }
  } catch (error) {
    console.error("Language detection error:", error);
  }

  return "Unknown";
}

export async function translateChunk(
  text: string,
  targetLanguage: string,
  cefrLevel: string,
  options?: { returnCleanOriginal?: boolean },
): Promise<TranslationBlock> {
  const gemini = getGemini();
  if (!gemini) return { original: text, translated: text };

  const levelGuidelines = getCefrGuidelines(targetLanguage, cefrLevel);
  const returnCleanOriginal = options?.returnCleanOriginal ?? false;

  const outputInstructions = returnCleanOriginal
    ? `Return JSON format:
{
  "original": "the CLEAN extracted article text in the SOURCE language (no HTML, no garbage)",
  "translated": "the complete adapted ${targetLanguage} text at ${cefrLevel} level",
  "bridge": "English translation that maps EXACTLY 1-1 to your translated text"
}

IMPORTANT:
- The "original" field must contain the clean, readable source article text.
- The "bridge" field must have the SAME NUMBER OF SENTENCES as "translated", in the same order.`
    : `Return JSON format:
{
  "original": "the source text you received (preserve it exactly)",
  "translated": "the complete adapted ${targetLanguage} text at ${cefrLevel} level",
  "bridge": "English translation that maps EXACTLY 1-1 to your translated text"
}

IMPORTANT:
- The "original" field must contain the input text you received - preserve it, do NOT summarize.
- The "bridge" field must have the SAME NUMBER OF SENTENCES as "translated", in the same order.`;

  const prompt = `You are a professional language learning content adapter. Your job is to extract article content and translate/adapt it into ${targetLanguage} for a ${cefrLevel} learner.

${levelGuidelines}

---

## CONTENT EXTRACTION RULES

The input may be either:
- Raw HTML from a news website (extract the article text, ignore all HTML tags/markup)
- Plain text that's already been extracted

From either format, extract ONLY the main article content.

INCLUDE: News paragraphs, quotes, factual information, analysis
EXCLUDE: HTML tags, subscription prompts, navigation, cookie notices, ads, "Read also" links

If the input contains ONLY non-article content, return: {"original": "", "translated": ""}

---

## YOUR TASK

1. If input is HTML: extract the article text first
2. Identify ALL key points, quotes, and facts
3. Translate/adapt into ${targetLanguage} at ${cefrLevel} level
4. Apply ALL grammar and vocabulary constraints from the guidelines above
5. Capture all significant information - don't over-summarize

${outputInstructions}

---

INPUT:
${text}`;

  try {
    const response = await gemini.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: prompt,
      config: { responseMimeType: "application/json" },
    });

    const content = response.text;
    if (content) {
      try {
        const parsed = JSON.parse(content);
        if (parsed.translated) {
          const originalText =
            returnCleanOriginal &&
            parsed.original &&
            parsed.original.length > 50
              ? parsed.original
              : text;
          return {
            original: originalText,
            translated: parsed.translated,
            bridge: parsed.bridge || undefined,
          };
        }
      } catch {
        console.error("Failed to parse AI response as JSON");
      }
    }
  } catch (error) {
    console.error("Gemini translation error:", error);
  }

  return { original: text, translated: text };
}
