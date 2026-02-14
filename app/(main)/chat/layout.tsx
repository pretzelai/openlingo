import { listConversations } from "@/lib/actions/chat";
import { ChatLayout } from "@/components/chat/chat-layout";

export default async function ChatRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const conversations = await listConversations();

  return <ChatLayout conversations={conversations}>{children}</ChatLayout>;
}
