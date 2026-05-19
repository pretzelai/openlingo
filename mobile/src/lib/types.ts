// ─── Content Types (mirrors web /lib/content/types.ts) ───

export interface Course {
  id: string;
  title: string;
  sourceLanguage: string;
  targetLanguage: string;
  level: string;
  visibility: string | null;
  createdBy: string | null;
  units: Unit[];
}

export interface Unit {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  lessons: UnitLesson[];
  parseError?: boolean;
}

export interface UnitLesson {
  title: string;
  description?: string;
  icon?: string;
  color?: string;
  exercises: Exercise[];
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
  choices?: string[];
  correctIndex?: number;
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
  completedLessons: number;
  visibility: string | null;
  creatorName: string | null;
  isOwner: boolean;
  isInLibrary?: boolean;
  parseError?: boolean;
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
  visibility: string | null;
  createdBy: string | null;
  lessons: UnitLesson[];
  parseError?: boolean;
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

// ─── Auth Types ───

export interface User {
  id: string;
  name: string;
  email: string;
  image?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Session {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
}

export interface AuthSession {
  user: User;
  session: Session;
}

// ─── SRS Types ───

export interface SrsCard {
  word: string;
  language: string;
  translation: string;
  cefrLevel: string | null;
  pos: string | null;
  gender: string | null;
  exampleNative: string | null;
  exampleEnglish: string | null;
  status: "new" | "learning" | "review";
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewAt: string | null;
  lastReviewedAt: string | null;
}

export interface SrsStats {
  total: number;
  due: number;
  new: number;
  learning: number;
  review: number;
}

// ─── Word Types ───

export interface WordLookupResult {
  word: string;
  baseForm: string;
  translation: string;
  pos: string;
  gender: string | null;
  cefrLevel: string;
  exampleNative: string;
  exampleEnglish: string;
}

// ─── Article Types ───

export interface Article {
  id: string;
  title: string;
  sourceUrl: string;
  sourceLanguage: string;
  targetLanguage: string;
  cefrLevel: string | null;
  status: "pending" | "fetching" | "translating" | "completed" | "failed";
  translationProgress: number | null;
  totalParagraphs: number | null;
  wordCount: number | null;
  audioUrl: string | null;
  createdAt: string;
}

export interface ArticleDetail extends Article {
  originalContent: string | null;
  translatedContent: string | null;
  errorMessage: string | null;
}

// ─── Chat Types ───

export interface ChatConversation {
  id: string;
  title: string | null;
  language: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt?: string;
}

// ─── Exercise Result ───

export interface ExerciseResult {
  exerciseIndex: number;
  exerciseType: string;
  correct: boolean;
  userAnswer: string;
}

// ─── User Stats ───

export interface UserStats {
  currentStreak: number;
  longestStreak: number;
  lastPracticeDate: string | null;
  totalLessonsCompleted: number;
}

// ─── Lesson Completion ───

export interface LessonCompletion {
  unitId: string;
  lessonIndex: number;
  results: ExerciseResult[];
  perfectScore: boolean;
}
