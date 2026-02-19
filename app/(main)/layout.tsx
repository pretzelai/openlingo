import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import { getUserStatsData } from "@/lib/actions/progress";
import { getSrsStats } from "@/lib/actions/srs";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { PostHogIdentify } from "@/components/providers/posthog-identify";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  let stats = null;
  try {
    const [userStatsData, srsStats] = await Promise.all([
      getUserStatsData(),
      getSrsStats(),
    ]);
    stats = {
      currentStreak: userStatsData.currentStreak,
      wordsLearned: srsStats.total,
    };
  } catch {
    // User may not have stats yet
  }

  return (
    <div className="min-h-screen bg-lingo-bg">
      <PostHogIdentify
        userId={session.user.id}
        email={session.user.email}
        name={session.user.name}
      />
      <Sidebar />
      <div className="md:pl-64">
        <TopBar stats={stats} />
        <main className="p-4 pb-20 md:p-8 md:pb-8">{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}
