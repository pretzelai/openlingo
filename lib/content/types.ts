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

/** A single lesson inside the unit's JSONB exercises array */
export interface UnitLesson {
  title: string;
  xpReward: number;
  exercises: Exercise[];
}

/**
 * @deprecated Use UnitLesson instead. Kept for loader compatibility.
 */
export interface Lesson {
  title: string;
  order: number;
  xpReward: number;
  exercises: Exercise[];
}

export type Exercise =
  | MultipleChoiceExercise
  | TranslationExercise
  | FillInTheBlankExercise
  | MatchingPairsExercise
  | ListeningExercise
  | WordBankExercise
  | SpeakingExercise;

export interface MultipleChoiceExercise {
  type: "multiple-choice";
  text: string;
  choices: string[];
  correctIndex: number;
  randomOrder?: boolean;
  noAudio?: string[];
}

export interface TranslationExercise {
  type: "translation";
  text: string;
  sentence: string;
  answer: string;
  acceptAlso: string[];
  noAudio?: string[];
}

export interface FillInTheBlankExercise {
  type: "fill-in-the-blank";
  sentence: string;
  blank: string;
  noAudio?: string[];
}

export interface MatchingPairsExercise {
  type: "matching-pairs";
  pairs: { left: string; right: string }[];
  randomOrder?: boolean;
  noAudio?: string[];
}

export interface ListeningExercise {
  type: "listening";
  text: string;
  ttsLang: string;
  mode?: "choices" | "word-bank";
  noAudio?: string[];
}

export interface WordBankExercise {
  type: "word-bank";
  text: string;
  words: string[];
  answer: string[];
  randomOrder?: boolean;
  noAudio?: string[];
}

export interface SpeakingExercise {
  type: "speaking";
  sentence: string;
  noAudio?: string[];
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
