import { and, desc, eq } from "drizzle-orm";
import type { Database } from "../types";
import { chatConversation } from "../lib/db/schema";

export async function listConversations(db: Database, userId: string) {
  return db
    .select({
      id: chatConversation.id,
      title: chatConversation.title,
      language: chatConversation.language,
      updatedAt: chatConversation.updatedAt,
    })
    .from(chatConversation)
    .where(eq(chatConversation.userId, userId))
    .orderBy(desc(chatConversation.updatedAt));
}

export async function getConversation(db: Database, userId: string, id: string) {
  const [row] = await db
    .select()
    .from(chatConversation)
    .where(and(eq(chatConversation.id, id), eq(chatConversation.userId, userId)))
    .limit(1);

  return row ?? null;
}

export async function createConversation(
  db: Database,
  userId: string,
  language: string,
  title: string,
  messages: unknown[],
) {
  const [row] = await db
    .insert(chatConversation)
    .values({ userId, language, title, messages })
    .returning({ id: chatConversation.id });

  return row.id;
}

export async function saveMessages(db: Database, userId: string, id: string, messages: unknown[]) {
  await db
    .update(chatConversation)
    .set({ messages, updatedAt: new Date() })
    .where(and(eq(chatConversation.id, id), eq(chatConversation.userId, userId)));
}

export async function deleteConversation(db: Database, userId: string, id: string) {
  await db
    .delete(chatConversation)
    .where(and(eq(chatConversation.id, id), eq(chatConversation.userId, userId)));
}
