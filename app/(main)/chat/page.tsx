import { requireSession } from "@/lib/auth-server";
import { ChatView } from "@/components/chat/chat-view";
import { getTargetLanguage } from "@/lib/actions/preferences";

export const metadata = { title: "Chat — LingoClaw" };

export default async function ChatPage() {
  const session = await requireSession();
  const language = await getTargetLanguage(session.user.id);

  return <ChatView language={language} />;
}
