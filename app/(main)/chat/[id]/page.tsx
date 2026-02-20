import { notFound } from "next/navigation";
import { getConversation } from "@/lib/actions/chat";
import { ChatView } from "@/components/chat/chat-view";
import { getPreferredModel } from "@/lib/actions/preferences";
import type { UIMessage } from "@ai-sdk/react";


export default async function ChatConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const conv = await getConversation(id);
  if (!conv) notFound();

  const preferredModel = await getPreferredModel();

  return (
    <ChatView
      key={conv.id}
      language={conv.language}
      preferredModel={preferredModel}
      conversationId={conv.id}
      initialMessages={conv.messages as UIMessage[]}
    />
  );
}
