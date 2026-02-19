"use server";

import { db } from "@/lib/db";
import { chatConversation } from "@/lib/db/schema";
import { and, eq, desc } from "drizzle-orm";
import { requireSession } from "@/lib/auth-server";
import { revalidatePath } from "next/cache";

export async function listConversations() {
  const session = await requireSession();

  return db
    .select({
      id: chatConversation.id,
      title: chatConversation.title,
      language: chatConversation.language,
      updatedAt: chatConversation.updatedAt,
    })
    .from(chatConversation)
    .where(eq(chatConversation.userId, session.user.id))
    .orderBy(desc(chatConversation.updatedAt));
}

export async function getConversation(id: string) {
  const session = await requireSession();

  const [row] = await db
    .select()
    .from(chatConversation)
    .where(
      and(
        eq(chatConversation.id, id),
        eq(chatConversation.userId, session.user.id)
      )
    )
    .limit(1);

  return row ?? null;
}

export async function createConversation(
  language: string,
  title: string,
  messages: unknown[]
) {
  const session = await requireSession();

  const [row] = await db
    .insert(chatConversation)
    .values({
      userId: session.user.id,
      language,
      title,
      messages,
    })
    .returning({ id: chatConversation.id });

  revalidatePath("/chat", "layout");
  return row.id;
}

export async function saveMessages(id: string, messages: unknown[]) {
  const session = await requireSession();

  await db
    .update(chatConversation)
    .set({ messages, updatedAt: new Date() })
    .where(
      and(
        eq(chatConversation.id, id),
        eq(chatConversation.userId, session.user.id)
      )
    );
}

export async function deleteConversation(id: string) {
  const session = await requireSession();

  await db
    .delete(chatConversation)
    .where(
      and(
        eq(chatConversation.id, id),
        eq(chatConversation.userId, session.user.id)
      )
    );

  revalidatePath("/chat", "layout");
}
