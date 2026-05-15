import { and, eq, like } from "drizzle-orm";
import type { Database } from "../types";
import { userMemory } from "../lib/db/schema";
import { PROMPT_DEFINITIONS, PROMPTS_BY_ID } from "../../../../lib/prompts";

export type PromptWithOverride = {
  id: string;
  displayName: string;
  description: string;
  defaultTemplate: string;
  variables: string[];
  customTemplate: string | null;
};

export async function getPrompts(db: Database, userId: string): Promise<PromptWithOverride[]> {
  const overrides = await db
    .select()
    .from(userMemory)
    .where(and(eq(userMemory.userId, userId), like(userMemory.key, "prompt:%")));

  const overrideMap = new Map(overrides.map((row) => [row.key.replace("prompt:", ""), row.value]));

  return PROMPT_DEFINITIONS.map((definition) => ({
    ...definition,
    customTemplate: overrideMap.get(definition.id) ?? null,
  }));
}

export async function savePrompt(db: Database, userId: string, id: string, value: string) {
  if (!PROMPTS_BY_ID[id]) {
    throw new Error(`Unknown prompt ID: ${id}`);
  }

  const key = `prompt:${id}`;

  await db
    .insert(userMemory)
    .values({ userId, key, value })
    .onConflictDoUpdate({
      target: [userMemory.userId, userMemory.key],
      set: { value, updatedAt: new Date() },
    });
}

export async function resetPrompt(db: Database, userId: string, id: string) {
  if (!PROMPTS_BY_ID[id]) {
    throw new Error(`Unknown prompt ID: ${id}`);
  }

  await db
    .delete(userMemory)
    .where(and(eq(userMemory.userId, userId), eq(userMemory.key, `prompt:${id}`)));
}

export async function getMemory(db: Database, userId: string): Promise<string> {
  const [row] = await db
    .select()
    .from(userMemory)
    .where(and(eq(userMemory.userId, userId), eq(userMemory.key, "memory")))
    .limit(1);

  return row?.value ?? "";
}

export async function saveMemory(db: Database, userId: string, value: string) {
  await db
    .insert(userMemory)
    .values({ userId, key: "memory", value })
    .onConflictDoUpdate({
      target: [userMemory.userId, userMemory.key],
      set: { value, updatedAt: new Date() },
    });
}

export async function getUserPromptTemplate(db: Database, userId: string, promptId: string): Promise<string> {
  const definition = PROMPTS_BY_ID[promptId];
  if (!definition) {
    throw new Error(`Unknown prompt ID: ${promptId}`);
  }

  const [override] = await db
    .select()
    .from(userMemory)
    .where(and(eq(userMemory.userId, userId), eq(userMemory.key, `prompt:${promptId}`)))
    .limit(1);

  return override?.value ?? definition.defaultTemplate;
}
