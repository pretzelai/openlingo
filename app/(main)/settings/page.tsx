import { getPrompts, getMemory } from "@/lib/actions/prompts";
import { getTargetLanguage } from "@/lib/actions/preferences";
import { getNativeLanguage } from "@/lib/actions/profile";
import { requireSession } from "@/lib/auth-server";
import { SettingsView } from "./settings-view";

export const metadata = { title: "Settings — LingoClaw" };

export default async function SettingsPage() {
  const session = await requireSession();
  const [prompts, memory, targetLanguage, nativeLanguage] = await Promise.all([
    getPrompts(),
    getMemory(),
    getTargetLanguage(session.user.id),
    getNativeLanguage(session.user.id),
  ]);

  return (
    <SettingsView
      prompts={prompts}
      initialMemory={memory}
      targetLanguage={targetLanguage}
      nativeLanguage={nativeLanguage}
    />
  );
}
