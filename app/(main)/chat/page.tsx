import { requireSession } from "@/lib/auth-server";
import { ChatView } from "@/components/chat/chat-view";

export const metadata = { title: "Chat — LingoClaw" };

export default async function ChatPage() {
  await requireSession();
  return <ChatView language="de" />;
}
