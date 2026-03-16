import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getSession } from "@/lib/auth-server";
import { getUserStatsData } from "@/lib/actions/progress";
import { getSrsStats } from "@/lib/actions/srs";
import { getGitHubStars } from "@/lib/github";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { MobileNav } from "@/components/layout/mobile-nav";
import { PostHogIdentify } from "@/components/providers/posthog-identify";
import { BackgroundRoutePrefetch } from "@/components/providers/background-route-prefetch";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) {
    const headersList = await headers();
    const pathname = headersList.get("x-pathname") || "";
    const redirectParam = pathname ? `?redirect=${encodeURIComponent(pathname)}` : "";
    redirect(`/sign-in${redirectParam}`);
  }

  let stats = null;
  let githubStars: number | null = null;
  try {
    const [userStatsData, srsStats, stars] = await Promise.all([
      getUserStatsData(),
      getSrsStats(),
      getGitHubStars(),
    ]);
    stats = {
      currentStreak: userStatsData.currentStreak,
      wordsLearned: srsStats.total,
    };
    githubStars = stars;
  } catch {
    // User may not have stats yet
  }

  return (
    <div className="h-dvh bg-lingo-bg flex flex-col md:flex-row">
      <PostHogIdentify
        userId={session.user.id}
        email={session.user.email}
        name={session.user.name}
      />
      <BackgroundRoutePrefetch />
      <Sidebar />
      <div className="flex flex-1 flex-col md:pl-64 min-h-0">
        <TopBar stats={stats} githubStars={githubStars} />
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-8 md:pb-8">{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}
