const BASE_URL = process.env.BASE_URL || "http://127.0.0.1:8080";

let cookie = "";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForBackend() {
  const deadline = Date.now() + 60_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok && (await res.text()) === "ok") return;
    } catch (err) {
      lastError = err;
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error(`Backend did not become healthy: ${lastError?.message || "timeout"}`);
}

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  if (cookie) headers.set("Cookie", cookie);
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  const setCookie = res.headers.get("set-cookie");
  if (setCookie) {
    cookie = setCookie.split(";")[0];
  }
  const contentType = res.headers.get("content-type") || "";
  const body = contentType.includes("application/json") ? await res.json() : await res.text();
  if (!res.ok) {
    throw new Error(`${options.method || "GET"} ${path} failed (${res.status}): ${JSON.stringify(body)}`);
  }
  return body;
}

async function main() {
  await waitForBackend();
  console.log("✓ health");

  const unique = Date.now();
  const email = `testing-refactor-${unique}@openlingo.dev`;
  const password = "0P3NL1NG0";
  const signup = await request("/api/auth/sign-up", {
    method: "POST",
    body: JSON.stringify({ name: "Refactor Smoke", email, password }),
  });
  assert(signup.user?.email === email, "sign-up did not return user");
  assert(cookie.includes("openlingo.session_token"), "session cookie was not set");
  console.log("✓ sign-up/session cookie");

  const session = await request("/api/auth/session");
  assert(session.user?.email === email, "session did not return signed-in user");
  console.log("✓ session lookup");

  const prefs = await request("/api/preferences", {
    method: "PUT",
    body: JSON.stringify({ nativeLanguage: "en", targetLanguage: "de", preferredModel: "gemini-3-flash-preview" }),
  });
  assert(prefs.targetLanguage === "de", "preferences were not saved");
  console.log("✓ preferences");

  const memorySave = await request("/api/memory", { method: "PUT", body: JSON.stringify({ value: "Smoke test memory" }) });
  assert(memorySave.success, "memory save failed");
  const memory = await request("/api/memory");
  assert(memory.value === "Smoke test memory", "memory read mismatch");
  console.log("✓ memory");

  const promptSave = await request("/api/prompts/chat-system", { method: "PUT", body: JSON.stringify({ value: "You are a smoke test tutor." }) });
  assert(promptSave.success, "prompt save failed");
  const prompts = await request("/api/prompts");
  assert(prompts.some((p) => p.id === "chat-system" && p.customTemplate), "prompt override missing");
  console.log("✓ prompts");

  const unitMarkdown = `---
unitTitle: "Smoke Unit"
description: "A tiny generated unit for the refactor smoke test."
icon: "🧪"
color: "#58CC02"
targetLanguage: "de"
sourceLanguage: "en"
level: "A1"
---

---
lessonTitle: "Basics"
description: "Learn one greeting"
icon: "👋"
---

[multiple-choice]
text: "What does Hallo mean?"
- "Hello" (correct)
- "Bye"
srsWords: "Hallo"
`;
  const createdUnit = await request("/api/units", { method: "POST", body: JSON.stringify({ markdown: unitMarkdown }) });
  assert(createdUnit.unitId, "unit was not created");
  const unit = await request(`/api/units/${createdUnit.unitId}`);
  assert(unit.lessons?.length === 1, "unit parser did not return one lesson");
  console.log("✓ unit create/read/parser");

  const lesson = await request("/api/lesson/complete", {
    method: "POST",
    body: JSON.stringify({
      unitId: createdUnit.unitId,
      lessonIndex: 0,
      results: [{ exerciseIndex: 0, exerciseType: "multiple-choice", correct: true, userAnswer: "Hello" }],
      mistakeCount: 0,
    }),
  });
  assert(lesson.perfectScore === true, "lesson completion did not return perfect score");
  console.log("✓ lesson completion/progress");

  const addWord = await request("/api/srs/words/Hallo", { method: "POST", body: JSON.stringify({ language: "de", translation: "Hello" }) });
  assert(addWord.success, "SRS add word failed");
  const srsStats = await request("/api/srs/stats?language=de");
  assert(srsStats.total >= 1, "SRS stats did not count added word");
  const review = await request("/api/srs/review", { method: "POST", body: JSON.stringify({ word: "Hallo", language: "de", quality: 4 }) });
  assert(review.status === "review", "SRS review did not schedule card");
  console.log("✓ SRS add/stats/review");

  const lookup = await request("/api/word/lookup?word=Hallo&language=de");
  assert(typeof lookup.found === "boolean", "word lookup returned invalid shape");
  console.log("✓ word lookup");

  const conversation = await request("/api/chat/conversations", {
    method: "POST",
    body: JSON.stringify({ language: "de", title: "Smoke chat", messages: [{ role: "user", content: "Hallo" }] }),
  });
  assert(conversation.id, "conversation was not created");
  const loadedConversation = await request(`/api/chat/conversations/${conversation.id}`);
  assert(loadedConversation.title === "Smoke chat", "conversation load failed");
  const chatRes = await fetch(`${BASE_URL}/api/chat/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ messages: [{ role: "user", content: "Say hello" }], language: "de" }),
  });
  assert(chatRes.ok, "chat stream failed");
  const chatText = await chatRes.text();
  assert(chatText.includes("event: delta"), "chat stream did not emit deltas");
  console.log("✓ chat conversations/stream");

  const article = await request("/api/articles", {
    method: "POST",
    body: JSON.stringify({ url: "https://example.com", targetLanguage: "German", cefrLevel: "A1" }),
  });
  assert(article.articleId, "article was not created");
  const articles = await request("/api/articles");
  assert(articles.some((a) => a.id === article.articleId), "article list missing created article");
  console.log("✓ articles create/list/job enqueue");

  const tts = await request("/api/tts", { method: "POST", body: JSON.stringify({ text: "Hallo", language: "de" }) });
  assert("url" in tts, "TTS response missing url field");
  console.log("✓ TTS endpoint");

  const form = new FormData();
  form.append("language", "en");
  form.append("audio", new Blob([new Uint8Array([0, 1, 2, 3])], { type: "audio/webm" }), "recording.webm");
  const stt = await request("/api/stt", { method: "POST", body: form });
  assert(typeof stt.text === "string", "STT response missing text");
  console.log("✓ STT endpoint");

  const aiPrompt = await request("/api/ai-prompt", { method: "POST", body: JSON.stringify({ prompt: "Return PASSED" }) });
  assert(typeof aiPrompt.result === "string", "AI prompt response missing result");
  console.log("✓ AI prompt endpoint");

  const feedback = await request("/api/feedback", { method: "POST", body: JSON.stringify({ message: "Smoke test feedback" }) });
  assert(feedback.success, "feedback failed");
  console.log("✓ feedback");

  await request("/api/auth/sign-out", { method: "POST" });
  console.log("✓ sign-out");

  console.log("\nAll smoke tests passed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
