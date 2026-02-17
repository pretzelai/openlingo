import { z } from "zod";

const noAudio = z.array(z.string()).optional().describe("Words to skip TTS for");

const srsWords = z.union([z.string().min(1), z.array(z.string()).min(1)]).describe("Target-language word(s) to track in SRS for this exercise");

export const multipleChoiceSchema = z.object({
  type: z.literal("multiple-choice"),
  text: z.string().describe("The question or prompt"),
  choices: z
    .array(z.string())
    .min(2)
    .max(4)
    .describe("Answer choices (2-4 items)"),
  correctIndex: z
    .number()
    .int()
    .min(0)
    .describe("Zero-based index of the correct choice"),
  randomOrder: z.boolean().optional().describe("Shuffle choices at runtime"),
  noAudio,
  srsWords,
});

export const translationSchema = z.object({
  type: z.literal("translation"),
  text: z.string().describe("Instruction, e.g. 'Translate to English'"),
  sentence: z.string().describe("The sentence to translate"),
  answer: z.string().describe("The primary correct translation"),
  acceptAlso: z
    .array(z.string())
    .default([])
    .describe("Alternative accepted translations"),
  noAudio,
  srsWords,
});

export const fillInTheBlankSchema = z.object({
  type: z.literal("fill-in-the-blank"),
  sentence: z
    .string()
    .describe("Sentence with ___ marking the blank, e.g. 'Der ___ ist groß'"),
  blank: z.string().describe("The correct word for the blank"),
  noAudio,
  srsWords,
});

export const matchingPairsSchema = z.object({
  type: z.literal("matching-pairs"),
  pairs: z
    .array(
      z.object({
        left: z.string().describe("Word in target language"),
        right: z.string().describe("English translation"),
      })
    )
    .min(2)
    .max(6)
    .describe("Pairs to match"),
  randomOrder: z.boolean().optional().describe("Shuffle pairs at runtime"),
  noAudio,
  srsWords,
});

export const wordBankSchema = z.object({
  type: z.literal("word-bank"),
  text: z.string().describe("Instruction or sentence to construct"),
  words: z
    .array(z.string())
    .describe("Available word tiles (include 1-2 distractors)"),
  answer: z.array(z.string()).describe("The correct word sequence"),
  randomOrder: z.boolean().optional().describe("Shuffle tiles at runtime"),
  noAudio,
  srsWords,
});

export const listeningSchema = z.object({
  type: z.literal("listening"),
  text: z.string().describe("The sentence to listen to"),
  ttsLang: z.string().describe("Language code for TTS, e.g. 'de'"),
  mode: z
    .enum(["choices", "word-bank"])
    .optional()
    .describe("'choices' for multiple-choice, 'word-bank' for reconstruction"),
  noAudio,
  srsWords,
});

export const speakingSchema = z.object({
  type: z.literal("speaking"),
  sentence: z.string().describe("The sentence the user should say aloud"),
  noAudio,
  srsWords,
});

export const freeTextSchema = z.object({
  type: z.literal("free-text"),
  text: z.string().describe("Instruction shown to user"),
  afterSubmitPrompt: z
    .string()
    .describe("AI prompt template — use {userResponse} as placeholder"),
  noAudio,
  srsWords: srsWords.optional(),
});

export const flashcardReviewSchema = z.object({
  type: z.literal("flashcard-review"),
  front: z.string().describe("Front of the card (markdown)"),
  back: z.string().describe("Back of the card (markdown)"),
  noAudio,
  srsWords,
});

export const exerciseSchema = z.discriminatedUnion("type", [
  multipleChoiceSchema,
  translationSchema,
  fillInTheBlankSchema,
  matchingPairsSchema,
  wordBankSchema,
  listeningSchema,
  speakingSchema,
  freeTextSchema,
  flashcardReviewSchema,
]);

export type ChatExercise = z.infer<typeof exerciseSchema>;
