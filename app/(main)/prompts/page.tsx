import { getPrompts, getMemory } from "@/lib/actions/prompts";
import { PromptsView } from "./prompts-view";

export const metadata = { title: "Prompts — LingoClaw" };

export default async function PromptsPage() {
  const [prompts, memory] = await Promise.all([getPrompts(), getMemory()]);

  return <PromptsView prompts={prompts} initialMemory={memory} />;
}
