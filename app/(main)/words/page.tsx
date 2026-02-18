import { getAllCards, getSrsStats } from "@/lib/actions/srs";
import { getTargetLanguage } from "@/lib/actions/preferences";
import { loadLanguageRaw } from "@/lib/words";
import { WordExplorer } from "./word-explorer";
import { redirect } from "next/navigation";

export const metadata = { title: "Words — LingoClaw" };

export default async function WordsPage() {
  const language = await getTargetLanguage();
  if (!language) redirect("/chat");

  const [words, srsCards, stats] = await Promise.all([
    loadLanguageRaw(language),
    getAllCards(language),
    getSrsStats(language),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <WordExplorer words={words} srsCards={srsCards} srsStats={stats} language={language} />
    </div>
  );
}
