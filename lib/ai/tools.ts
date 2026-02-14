import { tool } from "ai";
import { z } from "zod";
import { db } from "@/lib/db";
import { userMemory, srsCard } from "@/lib/db/schema";
import { and, eq, lte, count, sql } from "drizzle-orm";

export function createTools(userId: string, language?: string) {
  return {
    readMemory: tool({
      description: "Read a value from the user's memory by key",
      inputSchema: z.object({
        key: z.string().describe("The memory key to look up"),
      }),
      execute: async ({ key }) => {
        const [row] = await db
          .select()
          .from(userMemory)
          .where(and(eq(userMemory.userId, userId), eq(userMemory.key, key)))
          .limit(1);
        return row ? { found: true, value: row.value } : { found: false };
      },
    }),

    writeMemory: tool({
      description: "Store a value in the user's memory (upsert by key)",
      inputSchema: z.object({
        key: z.string().describe("The memory key"),
        value: z.string().describe("The value to store"),
      }),
      execute: async ({ key, value }) => {
        await db
          .insert(userMemory)
          .values({ userId, key, value })
          .onConflictDoUpdate({
            target: [userMemory.userId, userMemory.key],
            set: { value, updatedAt: new Date() },
          });
        return { success: true };
      },
    }),

    getDueCards: tool({
      description: "Get SRS cards that are due for review",
      inputSchema: z.object({
        limit: z
          .number()
          .optional()
          .default(20)
          .describe("Max cards to return"),
      }),
      execute: async ({ limit }) => {
        const now = new Date();
        const conditions = [
          eq(srsCard.userId, userId),
          lte(srsCard.nextReviewAt, now),
        ];
        if (language) {
          conditions.push(eq(srsCard.language, language));
        }
        const cards = await db
          .select()
          .from(srsCard)
          .where(and(...conditions))
          .orderBy(srsCard.nextReviewAt)
          .limit(limit);
        return { cards, count: cards.length };
      },
    }),

    getSrsStats: tool({
      description:
        "Get SRS statistics: total cards, due cards, and learned cards",
      inputSchema: z.object({}),
      execute: async () => {
        const now = new Date();
        const conditions = [eq(srsCard.userId, userId)];
        if (language) {
          conditions.push(eq(srsCard.language, language));
        }
        const baseWhere = and(...conditions);

        const [total] = await db
          .select({ count: count() })
          .from(srsCard)
          .where(baseWhere);

        const [due] = await db
          .select({ count: count() })
          .from(srsCard)
          .where(and(baseWhere, lte(srsCard.nextReviewAt, now)));

        const [learned] = await db
          .select({ count: count() })
          .from(srsCard)
          .where(and(baseWhere, sql`${srsCard.repetitions} >= 3`));

        return {
          total: total.count,
          due: due.count,
          learned: learned.count,
        };
      },
    }),
  };
}
