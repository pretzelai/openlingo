import { db } from "./index";
import { achievementDefinition } from "./schema";
import { ACHIEVEMENTS } from "../game/achievements";

export async function seedAchievements() {
  for (const a of ACHIEVEMENTS) {
    await db
      .insert(achievementDefinition)
      .values({
        id: a.id,
        title: a.title,
        description: a.description,
        icon: a.icon,
        category: a.category,
        requirement: a.requirement,
      })
      .onConflictDoNothing();
  }
}
