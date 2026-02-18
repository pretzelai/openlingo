import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { getModel, AVAILABLE_MODELS, createTools } from "@/lib/ai";
import { requireSession } from "@/lib/auth-server";
import { langCodeToName, interpolateTemplate, SRS_REFERENCE } from "@/lib/prompts";
import { getUserPromptTemplate } from "@/lib/actions/prompts";
import { getTargetLanguage } from "@/lib/actions/preferences";
import { getNativeLanguage } from "@/lib/actions/profile";
import { EXERCISE_SYNTAX } from "@/lib/content/exercise-syntax";
import { db } from "@/lib/db";
import { userMemory } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";
import { DEFAULT_AI_MODEL } from "@/lib/constants";

const DEFAULT_CHAT_MODEL = DEFAULT_AI_MODEL;

export async function POST(req: Request) {
  const session = await requireSession();
  const { messages, language: lang, model: requestedModel } = await req.json();

  const language: string = lang || (await getTargetLanguage(session.user.id)) || "en";
  const modelId = AVAILABLE_MODELS.some((m) => m.id === requestedModel)
    ? requestedModel
    : DEFAULT_CHAT_MODEL;
  const target_language = langCodeToName[language] || language;
  const tools = createTools(session.user.id, language);

  const [chatTemplate, memoryRow, nativeLang] = await Promise.all([
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
    getNativeLanguage(session.user.id),
  ]);

  const memory = memoryRow?.value ?? "";

  const native_language = nativeLang ? (langCodeToName[nativeLang] || nativeLang) : "English";

  const systemPrompt = interpolateTemplate(chatTemplate, {
    target_language,
    target_language_code: language,
    native_language,
    memory,
    exercise_syntax: EXERCISE_SYNTAX,
    srs_reference: SRS_REFERENCE,
  });

  const result = streamText({
    model: getModel(modelId),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(7),
  });

  return result.toUIMessageStreamResponse();
}
