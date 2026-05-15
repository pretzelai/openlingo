import { eq } from "drizzle-orm";
import type { Database } from "../types";
import { account } from "../lib/db/schema";
import { verifyTurnstileToken } from "../../../../lib/turnstile";

interface FeedbackInput {
  message: string;
  email?: string;
  turnstileToken?: string;
  slackWebhook?: string;
}

export async function submitFeedback(
  db: Database,
  session: { user: { id: string; name: string; email: string } } | null,
  input: FeedbackInput,
) {
  const { message, email, turnstileToken, slackWebhook } = input;

  if (!message.trim()) {
    return { success: false, error: "Message is required" };
  }

  if (!session) {
    if (!email?.trim()) {
      return { success: false, error: "Email is required" };
    }

    if (turnstileToken) {
      const result = await verifyTurnstileToken(turnstileToken);
      if (!result.success) {
        return { success: false, error: "Bot verification failed. Please try again." };
      }
    }
  }

  let authMethod = "";
  let senderName = "";
  let senderEmail = "";

  if (session) {
    senderName = session.user.name;
    senderEmail = session.user.email;

    try {
      const accounts = await db
        .select({ providerId: account.providerId })
        .from(account)
        .where(eq(account.userId, session.user.id));

      const providers = accounts.map((entry) => entry.providerId);
      if (providers.includes("google")) {
        authMethod = "Google OAuth";
      } else if (providers.includes("credential")) {
        authMethod = "Email/Password";
      } else {
        authMethod = providers.join(", ") || "Unknown";
      }
    } catch {
      authMethod = "Unknown";
    }
  } else {
    senderEmail = email!.trim();
  }

  const slackText = session
    ? [
        `*Feedback from:* ${senderName} (${senderEmail})`,
        `*Auth method:* ${authMethod}`,
        "---",
        message.trim(),
      ].join("\n")
    : [
        `*Feedback from (not logged in):* ${senderEmail}`,
        "---",
        message.trim(),
      ].join("\n");

  const webhookUrl = slackWebhook ?? process.env.SLACK_WEBHOOK;
  if (!webhookUrl) {
    console.warn("SLACK_WEBHOOK not set — feedback not delivered:", slackText);
    return { success: true };
  }

  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: slackText }),
    });

    if (!response.ok) {
      return { success: false, error: "Failed to send feedback. Please try again." };
    }

    return { success: true };
  } catch {
    return { success: false, error: "Failed to send feedback. Please try again." };
  }
}
