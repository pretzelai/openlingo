import { getPrompts, getMemory } from "@/lib/actions/prompts";
import { getTargetLanguage } from "@/lib/actions/preferences";
import { getNativeLanguage } from "@/lib/actions/profile";
import { requireSession } from "@/lib/auth-server";
import { PromptsView } from "./prompts-view";

export const metadata = { title: "Prompts — LingoClaw" };

export default async function PromptsPage() {
  const session = await requireSession();
  const [prompts, memory, targetLanguage, nativeLanguage] = await Promise.all([
    getPrompts(),
    getMemory(),
    getTargetLanguage(session.user.id),
    getNativeLanguage(session.user.id),
  ]);

  return (
    <PromptsView
      prompts={prompts}
      initialMemory={memory}
      targetLanguage={targetLanguage}
      nativeLanguage={nativeLanguage}
    />
  );
}
