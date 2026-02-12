import { getDueCards, getSrsStats } from "@/lib/actions/srs";
import { ReviewSession } from "./review-session";

export const metadata = { title: "Review — LingoClaw" };

export default async function ReviewPage() {
  const [dueCards, stats] = await Promise.all([
    getDueCards("de"),
    getSrsStats("de"),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <ReviewSession dueCards={dueCards} stats={stats} />
    </div>
  );
}
