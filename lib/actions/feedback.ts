"use server";

import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { account } from "@/lib/db/schema";
import { getSession } from "@/lib/auth-server";
import { verifyTurnstileToken } from "@/lib/turnstile";

interface FeedbackInput {
  message: string;
  email?: string;
  turnstileToken?: string;
}

interface FeedbackResult {
  success: boolean;
  error?: string;
}

export async function submitFeedback(
  input: FeedbackInput
): Promise<FeedbackResult> {
  const { message, email, turnstileToken } = input;

  if (!message.trim()) {
    return { success: false, error: "Message is required" };
  }

  const session = await getSession();

  // Unauthenticated: require turnstile and email
  if (!session) {
    if (!email?.trim()) {
      return { success: false, error: "Email is required" };
    }

    if (turnstileToken) {
      const result = await verifyTurnstileToken(turnstileToken);
      if (!result.success) {
        return {
          success: false,
          error: "Bot verification failed. Please try again.",
        };
      }
    }
  }

  // Determine auth method for authenticated users
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

      const providers = accounts.map((a) => a.providerId);
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

  // Build Slack message
  let slackText: string;
  if (session) {
    slackText = [
      `*Feedback from:* ${senderName} (${senderEmail})`,
      `*Auth method:* ${authMethod}`,
      "---",
      message.trim(),
    ].join("\n");
  } else {
    slackText = [
      `*Feedback from (not logged in):* ${senderEmail}`,
      "---",
      message.trim(),
    ].join("\n");
  }

  // Send to Slack
  const webhookUrl = process.env.SLACK_WEBHOOK;
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
      console.error("Slack webhook failed:", response.status);
      return { success: false, error: "Failed to send feedback. Please try again." };
    }

    return { success: true };
  } catch (err) {
    console.error("Slack webhook error:", err);
    return { success: false, error: "Failed to send feedback. Please try again." };
  }
}
