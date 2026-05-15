export type Preferences = {
  userId: string;
  nativeLanguage?: string | null;
  targetLanguage?: string | null;
  preferredModel?: string | null;
};

export type Unit = {
  id: string;
  courseId?: string | null;
  title: string;
  description: string;
  icon: string;
  color: string;
  markdown?: string;
  targetLanguage: string;
  sourceLanguage?: string | null;
  level?: string | null;
  visibility?: string | null;
  createdBy?: string | null;
  lessons: Lesson[];
  lessonCount: number;
};

export type Lesson = {
  title: string;
  description?: string;
  icon?: string;
  color?: string;
  exercises: Exercise[];
};

export type Exercise = Record<string, any> & { type: string };

export type Course = {
  id: string;
  title: string;
  sourceLanguage: string;
  targetLanguage: string;
  level: string;
  visibility?: string | null;
  unitCount?: number;
  lessonCount?: number;
};

export type SrsCard = {
  word: string;
  language: string;
  translation: string;
  status: string;
  easeFactor: number;
  interval: number;
  repetitions: number;
  nextReviewAt?: string | null;
};

export type Article = {
  id: string;
  sourceUrl: string;
  title?: string | null;
  targetLanguage: string;
  cefrLevel: string;
  translatedContent?: string | null;
  status: string;
  translationProgress: number;
  totalParagraphs: number;
  wordCount?: number | null;
  errorMessage?: string | null;
  audioUrl?: string | null;
  createdAt: string;
};

export const languages: Record<string, string> = {
  de: "German", fr: "French", es: "Spanish", it: "Italian", pt: "Portuguese", ru: "Russian",
  ar: "Arabic", hi: "Hindi", ko: "Korean", zh: "Mandarin", ja: "Japanese", en: "English",
};
