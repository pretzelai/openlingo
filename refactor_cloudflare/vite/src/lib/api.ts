const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/$/, "") ?? "";

export interface SessionUser {
  id: string;
  name?: string | null;
  email: string;
}

export interface Session {
  user: SessionUser;
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

export interface UnitSummary {
  id: string;
  title: string;
  description?: string | null;
  icon?: string | null;
  color?: string | null;
  targetLanguage?: string | null;
  sourceLanguage?: string | null;
  level?: string | null;
  lessonCount?: number;
  completedLessons?: number;
  visibility?: string | null;
  isOwner?: boolean;
  isInLibrary?: boolean;
}

export interface WordLookupResult {
  found: boolean;
  source?: "dictionary" | "ai";
  word: string;
  translation?: string;
  pos?: string | null;
  gender?: string | null;
  cefrLevel?: string | null;
  exampleNative?: string | null;
  exampleEnglish?: string | null;
}

export interface Preferences {
  nativeLanguage: string | null;
  targetLanguage: string | null;
  preferredModel: string;
}

export interface UserStats {
  currentStreak: number;
  longestStreak: number;
  totalLessonsCompleted: number;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
    ...init,
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({ error: response.statusText }));
    throw new Error(body.error ?? response.statusText);
  }

  return response.json() as Promise<T>;
}

export const api = {
  health: () => request<{ ok: boolean }>("/health"),
  session: () => request<{ session: Session | null }>("/api/session"),
  stars: () => request<{ stars: number | null }>("/api/github/stars"),
  courses: () => request<{ courses: CourseListItem[] }>("/api/courses"),
  units: () => request<{ units: UnitSummary[] }>("/api/units"),
  signIn: (email: string, password: string) =>
    request<unknown>("/api/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  signUp: (email: string, password: string, name: string) =>
    request<unknown>("/api/auth/sign-up/email", {
      method: "POST",
      body: JSON.stringify({ email, password, name }),
    }),
  signOut: () => request<unknown>("/api/auth/sign-out", { method: "POST", body: JSON.stringify({}) }),
  lookupWord: (word: string, language: string) =>
    request<WordLookupResult>(`/api/word/lookup?word=${encodeURIComponent(word)}&language=${encodeURIComponent(language)}`),
  profile: () => request<{ user: SessionUser; stats: UserStats; recentCompletions: unknown[] }>("/api/profile"),
  preferences: () => request<Preferences>("/api/preferences"),
  updatePreferences: (data: Partial<Preferences>) =>
    request<{ success: boolean }>("/api/preferences", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
  memory: () => request<{ value: string }>("/api/memory"),
  updateMemory: (value: string) =>
    request<{ success: boolean }>("/api/memory", {
      method: "PUT",
      body: JSON.stringify({ value }),
    }),
  srsStats: (language?: string) =>
    request<{ stats: { total: number; due: number; new: number; learning: number; review: number; learned: number } }>(
      `/api/srs/stats${language ? `?language=${encodeURIComponent(language)}` : ""}`,
    ),
  feedback: (message: string, email?: string) =>
    request<{ success: boolean }>("/api/feedback", {
      method: "POST",
      body: JSON.stringify({ message, email }),
    }),
};
