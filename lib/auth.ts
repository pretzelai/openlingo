import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { db } from "./db";
import * as schema from "./db/schema";
import { userStats, userPreferences } from "./db/schema";
import { DEFAULT_NATIVE_LANGUAGE } from "./constants";
import { turnstilePlugin } from "./turnstile-plugin";
import { sendEmail } from "./email";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_BASE_URL,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  plugins: [turnstilePlugin()],
  emailAndPassword: {
    enabled: true,
    sendResetPassword: async ({ user, url }) => {
      void sendEmail({
        to: user.email,
        subject: "Reset your OpenLingo password",
        html: `
          <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
            <h1 style="color: #58cc02; font-size: 28px; margin-bottom: 8px;">OpenLingo</h1>
            <p style="color: #777; font-size: 14px; margin-bottom: 32px;">Learn a language. Have fun.</p>
            <h2 style="color: #3c3c3c; font-size: 20px; margin-bottom: 16px;">Reset your password</h2>
            <p style="color: #3c3c3c; font-size: 16px; line-height: 1.5; margin-bottom: 24px;">
              Hi ${user.name || "there"},<br><br>
              We received a request to reset your password. Click the button below to choose a new one.
            </p>
            <a href="${url}" style="display: inline-block; background-color: #58cc02; color: white; font-weight: bold; text-decoration: none; padding: 12px 32px; border-radius: 12px; font-size: 16px;">
              Reset Password
            </a>
            <p style="color: #999; font-size: 13px; margin-top: 32px; line-height: 1.5;">
              If you didn't request this, you can safely ignore this email. This link will expire in 1 hour.
            </p>
          </div>
        `,
      });
    },
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
