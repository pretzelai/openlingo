import { z } from "zod";

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
});

export const fillInTheBlankSchema = z.object({
  type: z.literal("fill-in-the-blank"),
  sentence: z
    .string()
    .describe("Sentence with ___ marking the blank, e.g. 'Der ___ ist groß'"),
  blank: z.string().describe("The correct word for the blank"),
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
});

export const wordBankSchema = z.object({
  type: z.literal("word-bank"),
  text: z.string().describe("Instruction or sentence to construct"),
  words: z
    .array(z.string())
    .describe("Available word tiles (include 1-2 distractors)"),
  answer: z.array(z.string()).describe("The correct word sequence"),
});

export const listeningSchema = z.object({
  type: z.literal("listening"),
  text: z.string().describe("The sentence to listen to"),
  ttsLang: z.string().describe("Language code for TTS, e.g. 'de'"),
  mode: z
    .enum(["choices", "word-bank"])
    .optional()
    .describe("'choices' for multiple-choice, 'word-bank' for reconstruction"),
});

export const exerciseSchema = z.discriminatedUnion("type", [
  multipleChoiceSchema,
  translationSchema,
  fillInTheBlankSchema,
  matchingPairsSchema,
  wordBankSchema,
  listeningSchema,
]);

export type ChatExercise = z.infer<typeof exerciseSchema>;

export const unitLessonSchema = z.object({
  title: z.string().describe("Short lesson title, e.g. 'Ordering Drinks'"),
  xpReward: z
    .number()
    .int()
    .min(5)
    .max(30)
    .describe("XP reward for completing this lesson"),
  exercises: z
    .array(exerciseSchema)
    .min(3)
    .max(8)
    .describe("Interactive exercises for this lesson"),
});

export const generatedUnitSchema = z.object({
  title: z.string().describe("Unit title, e.g. 'Restaurant German'"),
  description: z
    .string()
    .describe("One-sentence description of what the unit covers"),
  icon: z.string().describe("Single emoji icon for the unit"),
  color: z
    .string()
    .describe("Tailwind color name (e.g. 'blue', 'green', 'purple')"),
  lessons: z
    .array(unitLessonSchema)
    .min(3)
    .max(6)
    .describe("Ordered lessons in this unit"),
});
