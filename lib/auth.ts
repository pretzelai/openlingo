import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "./db/schema";
import { userStats, userPreferences } from "./db/schema";
import { DEFAULT_NATIVE_LANGUAGE } from "./constants";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_BASE_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  emailAndPassword: {
    enabled: true,
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
  },
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          const userStatsInsert = db
            .insert(userStats)
            .values({ userId: user.id })
            .onConflictDoNothing();
          const userPreferencesInsert = db
            .insert(userPreferences)
            .values({
              userId: user.id,
              nativeLanguage: DEFAULT_NATIVE_LANGUAGE,
            })
            .onConflictDoNothing();

          const slackNotification = process.env.SLACK_WEBHOOK
            ? fetch(process.env.SLACK_WEBHOOK, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  text: `New user signup: ${user.name} (${user.email})`,
                }),
              }).catch(() => {})
            : Promise.resolve();

          await Promise.all([
            userStatsInsert,
            userPreferencesInsert,
            slackNotification,
          ]);
        },
      },
    },
  },
});
