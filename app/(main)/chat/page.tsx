import { requireSession } from "@/lib/auth-server";
import { ChatView } from "@/components/chat/chat-view";
import { db } from "@/lib/db";
import { userCourseEnrollment, course } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export const metadata = { title: "Chat — LingoClaw" };

export default async function ChatPage() {
  const session = await requireSession();

  // Derive language from user's first course enrollment
  let language = "de";
  const [enrollment] = await db
    .select({ courseId: userCourseEnrollment.courseId })
    .from(userCourseEnrollment)
    .where(eq(userCourseEnrollment.userId, session.user.id))
    .limit(1);

  if (enrollment) {
    const [c] = await db
      .select({ targetLanguage: course.targetLanguage })
      .from(course)
      .where(eq(course.id, enrollment.courseId))
      .limit(1);
    if (c) {
      language = c.targetLanguage;
    }
  }

  return <ChatView language={language} />;
}
