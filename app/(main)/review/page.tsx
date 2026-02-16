import { getDueCards, getSrsStats } from "@/lib/actions/srs";
import { requireSession } from "@/lib/auth-server";
import { getUserPromptTemplate } from "@/lib/actions/prompts";
import { getTargetLanguage } from "@/lib/actions/preferences";
import { ReviewSession } from "./review-session";

export const metadata = { title: "Review — LingoClaw" };

export default async function ReviewPage() {
  const session = await requireSession();
  const language = await getTargetLanguage(session.user.id);

  const [dueCards, stats, aiPromptTemplate] = await Promise.all([
    getDueCards(language),
    getSrsStats(language),
    getUserPromptTemplate(session.user.id, "review-ai"),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <ReviewSession
        dueCards={dueCards}
        stats={stats}
        aiPromptTemplate={aiPromptTemplate}
        language={language}
      />
    </div>
  );
}
