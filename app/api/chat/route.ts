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
          eq(userMemory.key, "memory")
        )
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
