import words from "@/words/german.json";
import { getAllCards, getSrsStats } from "@/lib/actions/srs";
import { WordExplorer } from "./word-explorer";

export const metadata = { title: "Words — LingoClaw" };

export default async function WordsPage() {
  const [srsCards, stats] = await Promise.all([
    getAllCards("de"),
    getSrsStats("de"),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <WordExplorer words={words} srsCards={srsCards} srsStats={stats} language="de" />
    </div>
  );
}
