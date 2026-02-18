import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "./db/schema";
import { userStats, userPreferences } from "./db/schema";
import { DEFAULT_NATIVE_LANGUAGE } from "./constants";

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          await db
            .insert(userStats)
            .values({ userId: user.id })
            .onConflictDoNothing();
          await db
            .insert(userPreferences)
            .values({
              userId: user.id,
              nativeLanguage: DEFAULT_NATIVE_LANGUAGE,
            })
            .onConflictDoNothing();
        },
      },
    },
  },
});
