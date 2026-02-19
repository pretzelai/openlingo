export interface Course {
  id: string;
  title: string;
  sourceLanguage: string;
  targetLanguage: string;
  level: string;
  units: Unit[];
}

export interface Unit {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  lessons: UnitLesson[];
}

/**
 * All metadata extracted from unit markdown frontmatter.
 * The markdown is the single source of truth — DB columns mirror these for fast queries.
 */
export interface ParsedUnitMeta {
  title: string;
  description: string;
  icon: string;
  color: string;
  targetLanguage: string | null;
  sourceLanguage: string | null;
  level: string | null;
  courseId: string | null;
}

/** Full result of parsing unit markdown: metadata + lessons. */
export interface ParsedUnit extends ParsedUnitMeta {
  lessons: UnitLesson[];
}

/** A single lesson inside a unit. */
export interface UnitLesson {
  title: string;
  description?: string;
  icon?: string;
  color?: string;
  exercises: Exercise[];
}

/** Parsed course metadata from a course markdown file. */
export interface ParsedCourse {
  id: string | null;
  courseTitle: string;
  description: string;
  sourceLanguage: string;
  targetLanguage: string;
  level: string;
}

export type Exercise =
  | MultipleChoiceExercise
  | TranslationExercise
  | FillInTheBlankExercise
  | MatchingPairsExercise
  | ListeningExercise
  | WordBankExercise
  | SpeakingExercise
  | FreeTextExercise
  | FlashcardReviewExercise;

export interface MultipleChoiceExercise {
  type: "multiple-choice";
  text: string;
  choices: string[];
  correctIndex: number;
  randomOrder?: boolean;
  noAudio?: string[];
  srsWords: string | string[];
}

export interface TranslationExercise {
  type: "translation";
  text: string;
  sentence: string;
  answer: string;
  acceptAlso: string[];
  noAudio?: string[];
  srsWords: string | string[];
}

export interface FillInTheBlankExercise {
  type: "fill-in-the-blank";
  sentence: string;
  blank: string;
  noAudio?: string[];
  srsWords: string | string[];
}

export interface MatchingPairsExercise {
  type: "matching-pairs";
  pairs: { left: string; right: string }[];
  randomOrder?: boolean;
  noAudio?: string[];
  srsWords: string | string[];
}

export interface ListeningExercise {
  type: "listening";
  text: string;
  ttsLang: string;
  mode?: "choices" | "word-bank";
  noAudio?: string[];
  srsWords: string | string[];
}

export interface WordBankExercise {
  type: "word-bank";
  text: string;
  words: string[];
  answer: string[];
  randomOrder?: boolean;
  noAudio?: string[];
  srsWords: string | string[];
}

export interface SpeakingExercise {
  type: "speaking";
  sentence: string;
  noAudio?: string[];
  srsWords: string | string[];
}

export interface FreeTextExercise {
  type: "free-text";
  text: string;
  afterSubmitPrompt: string;
  noAudio?: string[];
  srsWords?: string | string[];
}

export interface FlashcardReviewExercise {
  type: "flashcard-review";
  front: string;
  back: string;
  noAudio?: string[];
  srsWords: string | string[];
}

export interface CourseListItem {
  id: string;
  title: string;
  sourceLanguage: string;
  targetLanguage: string;
  level: string;
  unitCount: number;
  lessonCount: number;
}

export interface EnrolledCourseInfo extends CourseListItem {
  currentUnitId: string | null;
  currentLessonIndex: number;
  completedLessons: number;
}

export interface StandaloneUnitInfo {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  targetLanguage: string;
  sourceLanguage: string | null;
  level: string | null;
  lessonCount: number;
}

export interface UnitWithContent {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  targetLanguage: string;
  sourceLanguage: string | null;
  level: string | null;
  courseId: string | null;
  lessons: UnitLesson[];
}
