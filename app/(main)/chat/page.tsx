import { requireSession } from "@/lib/auth-server";
import { ChatView } from "@/components/chat/chat-view";
import { getTargetLanguage, getPreferredModel } from "@/lib/actions/preferences";

export const metadata = { title: "Chat — LingoClaw" };

export default async function ChatPage() {
  const session = await requireSession();
  const [language, preferredModel] = await Promise.all([
    getTargetLanguage(session.user.id),
    getPreferredModel(session.user.id),
  ]);

  return <ChatView key="new" language={language} preferredModel={preferredModel} />;
}
