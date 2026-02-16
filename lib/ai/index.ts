import { db } from "@/lib/db";
import { userPreferences } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { getModel } from "./models";

export { getModel, AVAILABLE_MODELS } from "./models";
export { createTools } from "./tools";

const DEFAULT_MODEL = "gemini-2.5-flash";

export async function getUserModel(userId: string) {
  const [row] = await db
    .select({ preferredModel: userPreferences.preferredModel })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1);

  return getModel(row?.preferredModel ?? DEFAULT_MODEL);
}
