import { requireSession } from "@/lib/auth-server";
import { ChatView } from "@/components/chat/chat-view";
import {
  getTargetLanguage,
  getPreferredModel,
} from "@/lib/actions/preferences";


export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ prompt?: string }>;
}) {
  const session = await requireSession();
  const [language, preferredModel, params] = await Promise.all([
    getTargetLanguage(session.user.id),
    getPreferredModel(session.user.id),
    searchParams,
  ]);

  return (
    <ChatView
      key={params.prompt ? `prompt-${params.prompt}` : "new"}
      language={language ?? undefined}
      preferredModel={preferredModel}
      initialPrompt={params.prompt}
    />
  );
}
