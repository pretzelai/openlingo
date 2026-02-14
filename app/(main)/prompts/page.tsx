import { getPrompts } from "@/lib/actions/prompts";
import { PromptEditor } from "./prompt-editor";

export const metadata = { title: "Prompts — LingoClaw" };

export default async function PromptsPage() {
  const prompts = await getPrompts();

  return (
    <div className="mx-auto max-w-2xl py-6">
      <h1 className="text-2xl font-black text-lingo-text mb-1">AI Prompts</h1>
      <p className="text-sm text-lingo-text-light font-bold mb-6">
        Customize the prompts used by AI features throughout the app.
      </p>
      <div className="space-y-4">
        {prompts.map((p) => (
          <PromptEditor key={p.id} prompt={p} />
        ))}
      </div>
    </div>
  );
}
