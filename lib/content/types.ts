export interface Course {
  id: string;
  title: string;
  sourceLanguage: string;
  targetLanguage: string;
  level: string;
  units: Unit[];
}

export interface Unit {
  title: string;
  description: string;
  order: number;
  icon: string;
  color: string;
  lessons: Lesson[];
}

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
  | WordBankExercise;

export interface MultipleChoiceExercise {
  type: "multiple-choice";
  prompt: string;
  choices: string[];
  correctIndex: number;
  randomOrder?: boolean;
}

export interface TranslationExercise {
  type: "translation";
  prompt: string;
  sentence: string;
  answer: string;
  acceptAlso: string[];
}

export interface FillInTheBlankExercise {
  type: "fill-in-the-blank";
  sentence: string;
  blank: string;
}

export interface MatchingPairsExercise {
  type: "matching-pairs";
  pairs: { left: string; right: string }[];
  randomOrder?: boolean;
}

export interface ListeningExercise {
  type: "listening";
  text: string;
  ttsLang: string;
  mode?: "choices" | "word-bank";
}

export interface WordBankExercise {
  type: "word-bank";
  prompt: string;
  words: string[];
  answer: string[];
  randomOrder?: boolean;
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
  currentUnitIndex: number;
  currentLessonIndex: number;
  completedLessons: number;
}
