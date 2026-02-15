import { streamText, convertToModelMessages, stepCountIs } from "ai";
import { getModel, createTools } from "@/lib/ai";
import { requireSession } from "@/lib/auth-server";
import { langCodeToName, interpolateTemplate } from "@/lib/prompts";
import { getUserPromptTemplate } from "@/lib/actions/prompts";
import { db } from "@/lib/db";
import { userMemory } from "@/lib/db/schema";
import { and, eq } from "drizzle-orm";

export async function POST(req: Request) {
  const session = await requireSession();
  const { messages, language: lang } = await req.json();

  const language: string = lang || "de";
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
  });

  const result = streamText({
    model: getModel("gemini-2.5-flash"),
    system: systemPrompt,
    messages: await convertToModelMessages(messages),
    tools,
    stopWhen: stepCountIs(7),
  });

  return result.toUIMessageStreamResponse();
}
