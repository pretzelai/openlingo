import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { getUserModel, createTools } from "@/lib/ai";
import { requireSession } from "@/lib/auth-server";
import { langCodeToName, interpolateTemplate } from "@/lib/prompts";
import { getUserPromptTemplate } from "@/lib/actions/prompts";
import { getTargetLanguage } from "@/lib/actions/preferences";
import { EXERCISE_SYNTAX } from "@/lib/content/exercise-syntax";
import { db } from "@/lib/db";
import { userMemory } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

const SRS_REFERENCE = `-- Table DDL
CREATE TABLE srs_card (
  word        TEXT NOT NULL,            -- always stored lowercase
  language    TEXT NOT NULL,            -- e.g. 'de', 'fr', 'es'
  user_id     TEXT NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
  translation TEXT NOT NULL,
  cefr_level  TEXT,                     -- A1, A2, B1, B2, C1, C2
  pos         TEXT,                     -- part of speech
  gender      TEXT,                     -- grammatical gender (nullable)
  example_native  TEXT,
  example_english TEXT,
  status      TEXT NOT NULL DEFAULT 'new',   -- 'new' | 'learning' | 'review'
  ease_factor REAL NOT NULL DEFAULT 2.5,
  interval    INTEGER NOT NULL DEFAULT 0,    -- days until next review
  repetitions INTEGER NOT NULL DEFAULT 0,
  next_review_at  TIMESTAMP,
  last_reviewed_at TIMESTAMP,
  created_at  TIMESTAMP NOT NULL DEFAULT now(),
  PRIMARY KEY (word, language, user_id)
);

Be careful if you use LIMIT parameter in your SQL queries as they don't give the full picture.
For example you should NOT use LIMIT for due cards.

-- SM-2 Algorithm Rules (apply these when updating a card after review)
-- Quality scale: 0=blackout, 1=wrong, 2=wrong but close, 3=correct with difficulty, 4=correct, 5=perfect
--
-- If quality >= 3 (correct):
--   if repetitions = 0: interval = 1
--   else if repetitions = 1: interval = 6
--   else: interval = round(interval * ease_factor)
--   repetitions = repetitions + 1
-- If quality < 3 (incorrect):
--   repetitions = 0, interval = 1
--
-- Always update ease_factor:
--   ease_factor = ease_factor + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02))
--   ease_factor = greatest(1.3, ease_factor)
--
-- Status transitions:
--   'new' -> 'learning' (on first review)
--   'learning' -> 'review' (when repetitions >= 3)
--   'review' -> 'learning' (if quality < 3)
--
-- next_review_at = now() + (interval || ' days')::interval
--
-- A card is "due" when status IN ('learning','review') AND next_review_at <= now()
-- To introduce new cards: UPDATE status='learning', next_review_at=now() WHERE status='new'`;

export async function POST(req: Request) {
  const session = await requireSession();
  const { messages, language: lang } = await req.json();

  const language: string = lang || (await getTargetLanguage(session.user.id));
  const langName = langCodeToName[language] || language;
  const tools = createTools(session.user.id, language);

  const [chatTemplate, memoryRow] = await Promise.all([
    getUserPromptTemplate(session.user.id, "chat-system"),
    db
      .select()
      .from(userMemory)
      .where(
        and(
          eq(userMemory.userId, session.user.id),
          eq(userMemory.key, "memory"),
        ),
      )
      .limit(1)
      .then((rows) => rows[0]),
  ]);

  const memory = memoryRow?.value ?? "";

  const systemPrompt = interpolateTemplate(chatTemplate, {
    langName,
    language,
    memory,
    exerciseSyntax: EXERCISE_SYNTAX,
    srsReference: SRS_REFERENCE,
  });

  const result = streamText({
    model: await getUserModel(session.user.id),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(7),
  });

  return result.toUIMessageStreamResponse();
}
