import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const fromEmail =
  process.env.RESEND_FROM_EMAIL || "OpenLingo <onboarding@resend.dev>";

interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
}

export async function sendEmail({ to, subject, html }: SendEmailOptions) {
  if (!resend) {
    console.warn(
      "[email] RESEND_API_KEY is not set — skipping email send to:",
      to
    );
    console.warn("[email] Subject:", subject);
    return;
  }

  const { data, error } = await resend.emails.send({
    from: fromEmail,
    to: [to],
    subject,
    html,
  });

  if (error) {
    console.error("[email] Failed to send email:", error);
    return;
  }

  return data;
}
