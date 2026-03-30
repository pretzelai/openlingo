import * as SecureStore from "expo-secure-store";
import type {
  AuthSession,
  Article,
  ArticleDetail,
  ChatConversation,
  ChatMessage,
  SrsCard,
  SrsStats,
  StandaloneUnitInfo,
  UnitWithContent,
  UserStats,
  WordLookupResult,
  LessonCompletion,
  ExerciseResult,
} from "./types";

// ─── Configuration ───

const API_URL_KEY = "openlingo_api_url";
const SESSION_TOKEN_KEY = "openlingo_session_token";

let _apiUrl = "";
let _sessionToken = "";

export async function getApiUrl(): Promise<string> {
  if (_apiUrl) return _apiUrl;
  const stored = await SecureStore.getItemAsync(API_URL_KEY);
  _apiUrl = stored || "";
  return _apiUrl;
}

export async function setApiUrl(url: string): Promise<void> {
  _apiUrl = url.replace(/\/$/, ""); // Remove trailing slash
  await SecureStore.setItemAsync(API_URL_KEY, _apiUrl);
}

export async function getSessionToken(): Promise<string> {
  if (_sessionToken) return _sessionToken;
  const stored = await SecureStore.getItemAsync(SESSION_TOKEN_KEY);
  _sessionToken = stored || "";
  return _sessionToken;
}

export async function setSessionToken(token: string): Promise<void> {
  _sessionToken = token;
  await SecureStore.setItemAsync(SESSION_TOKEN_KEY, token);
}

export async function clearSession(): Promise<void> {
  _sessionToken = "";
  await SecureStore.deleteItemAsync(SESSION_TOKEN_KEY);
}

// ─── HTTP Client ───

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const apiUrl = await getApiUrl();
  if (!apiUrl) throw new Error("API URL not configured");

  const token = await getSessionToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers["Cookie"] = `openlingo.session_token=${token}`;
  }

  const res = await fetch(`${apiUrl}${path}`, {
    ...options,
    headers,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "Unknown error");
    throw new ApiError(res.status, text);
  }

  const contentType = res.headers.get("content-type");
  if (contentType?.includes("application/json")) {
    return res.json();
  }
  return res.text() as unknown as T;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

// ─── Auth ───

export async function signIn(
  email: string,
  password: string
): Promise<AuthSession> {
  const apiUrl = await getApiUrl();
  if (!apiUrl) throw new Error("API URL not configured");

  const res = await fetch(`${apiUrl}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: "Sign in failed" }));
    throw new Error(body.message || "Sign in failed");
  }

  // Extract session token from Set-Cookie header
  const cookies = res.headers.get("set-cookie");
  if (cookies) {
    const tokenMatch = cookies.match(/openlingo\.session_token=([^;]+)/);
    if (tokenMatch) {
      await setSessionToken(tokenMatch[1]);
    }
  }

  // Also check the JSON response for token
  const data = await res.json();
  if (data.token) {
    await setSessionToken(data.token);
  }

  return data;
}

export async function signUp(
  name: string,
  email: string,
  password: string
): Promise<AuthSession> {
  const apiUrl = await getApiUrl();
  if (!apiUrl) throw new Error("API URL not configured");

  const res = await fetch(`${apiUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ message: "Sign up failed" }));
    throw new Error(body.message || "Sign up failed");
  }

  const cookies = res.headers.get("set-cookie");
  if (cookies) {
    const tokenMatch = cookies.match(/openlingo\.session_token=([^;]+)/);
    if (tokenMatch) {
      await setSessionToken(tokenMatch[1]);
    }
  }

  const data = await res.json();
  if (data.token) {
    await setSessionToken(data.token);
  }

  return data;
}

export async function signOut(): Promise<void> {
  try {
    await request("/api/auth/sign-out", { method: "POST" });
  } catch {
    // Ignore errors on sign-out
  }
  await clearSession();
}

export async function getSession(): Promise<AuthSession | null> {
  try {
    const data = await request<AuthSession>("/api/auth/get-session");
    return data;
  } catch {
    return null;
  }
}

// ─── User Preferences ───

export async function getTargetLanguage(): Promise<string | null> {
  const data = await request<{ targetLanguage: string | null }>(
    "/api/auth/get-session"
  );
  // We get this from the preferences endpoint if it exists
  try {
    const prefs = await request<{ targetLanguage: string | null }>(
      "/api/preferences/target-language"
    );
    return prefs.targetLanguage;
  } catch {
    return null;
  }
}

export async function updateTargetLanguage(language: string): Promise<void> {
  await request("/api/preferences/target-language", {
    method: "POST",
    body: JSON.stringify({ targetLanguage: language }),
  });
}

export async function getNativeLanguage(): Promise<string | null> {
  try {
    const prefs = await request<{ nativeLanguage: string | null }>(
      "/api/preferences/native-language"
    );
    return prefs.nativeLanguage;
  } catch {
    return null;
  }
}

export async function updateNativeLanguage(language: string): Promise<void> {
  await request("/api/preferences/native-language", {
    method: "POST",
    body: JSON.stringify({ nativeLanguage: language }),
  });
}

// ─── Chat ───

export async function listConversations(): Promise<ChatConversation[]> {
  return request<ChatConversation[]>("/api/conversations");
}

export async function getConversation(
  id: string
): Promise<{ conversation: ChatConversation; messages: ChatMessage[] }> {
  return request(`/api/conversations/${id}`);
}

export async function createConversation(
  title: string,
  language: string | null
): Promise<ChatConversation> {
  return request<ChatConversation>("/api/conversations", {
    method: "POST",
    body: JSON.stringify({ title, language }),
  });
}

export async function deleteConversation(id: string): Promise<void> {
  await request(`/api/conversations/${id}`, { method: "DELETE" });
}

/**
 * Stream a chat message. Returns an async iterator of text chunks.
 */
export async function streamChat(
  messages: Array<{ role: string; content: string }>,
  language: string,
  model?: string
): Promise<Response> {
  const apiUrl = await getApiUrl();
  if (!apiUrl) throw new Error("API URL not configured");

  const token = await getSessionToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) {
    headers["Cookie"] = `openlingo.session_token=${token}`;
  }

  const res = await fetch(`${apiUrl}/api/chat`, {
    method: "POST",
    headers,
    body: JSON.stringify({ messages, language, model }),
  });

  if (!res.ok) {
    throw new ApiError(res.status, await res.text());
  }

  return res;
}

// ─── Units & Courses ───

export async function getUnits(): Promise<StandaloneUnitInfo[]> {
  return request<StandaloneUnitInfo[]>("/api/units");
}

export async function getUnit(id: string): Promise<UnitWithContent> {
  return request<UnitWithContent>(`/api/units/${id}`);
}

// ─── Lessons ───

export async function completeLesson(
  data: LessonCompletion
): Promise<{ success: boolean }> {
  return request<{ success: boolean }>("/api/lessons/complete", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// ─── SRS / Words ───

export async function getDueCards(): Promise<SrsCard[]> {
  return request<SrsCard[]>("/api/srs/due");
}

export async function getAllCards(): Promise<SrsCard[]> {
  return request<SrsCard[]>("/api/srs/cards");
}

export async function getSrsStats(): Promise<SrsStats> {
  return request<SrsStats>("/api/srs/stats");
}

export async function reviewCard(
  word: string,
  language: string,
  quality: number
): Promise<SrsCard> {
  return request<SrsCard>("/api/srs/review", {
    method: "POST",
    body: JSON.stringify({ word, language, quality }),
  });
}

export async function addWordToSrs(
  word: string,
  language: string,
  translation: string,
  cefrLevel?: string,
  pos?: string
): Promise<SrsCard> {
  return request<SrsCard>("/api/srs/add", {
    method: "POST",
    body: JSON.stringify({ word, language, translation, cefrLevel, pos }),
  });
}

export async function removeWordFromSrs(
  word: string,
  language: string
): Promise<void> {
  await request("/api/srs/remove", {
    method: "POST",
    body: JSON.stringify({ word, language }),
  });
}

// ─── Word Lookup ───

export async function lookupWord(
  word: string,
  language: string
): Promise<WordLookupResult> {
  return request<WordLookupResult>(
    `/api/word/lookup?word=${encodeURIComponent(word)}&language=${encodeURIComponent(language)}`
  );
}

// ─── TTS ───

export async function getTtsUrl(
  text: string,
  language: string
): Promise<string> {
  const data = await request<{ url: string }>("/api/tts", {
    method: "POST",
    body: JSON.stringify({ text, language }),
  });
  return data.url;
}

// ─── Articles ───

export async function getArticles(): Promise<Article[]> {
  return request<Article[]>("/api/articles");
}

export async function getArticle(id: string): Promise<ArticleDetail> {
  return request<ArticleDetail>(`/api/articles/${id}`);
}

export async function deleteArticle(id: string): Promise<void> {
  await request(`/api/articles/${id}`, { method: "DELETE" });
}

export async function getArticleStatus(
  id: string
): Promise<{ status: string; progress: number }> {
  return request(`/api/articles/${id}/status`);
}

// ─── User Stats ───

export async function getUserStats(): Promise<UserStats> {
  return request<UserStats>("/api/stats");
}

// ─── AI Prompt ───

export async function aiPrompt(prompt: string): Promise<{ text: string }> {
  return request<{ text: string }>("/api/ai-prompt", {
    method: "POST",
    body: JSON.stringify({ prompt }),
  });
}
