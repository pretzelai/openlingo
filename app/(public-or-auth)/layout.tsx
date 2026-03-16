import Link from "next/link";
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

export default async function PublicOrAuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  // Authenticated: render full app layout (sidebar, topbar, mobile nav)
  if (session) {
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
      <div className="min-h-screen bg-lingo-bg">
        <PostHogIdentify
          userId={session.user.id}
          email={session.user.email}
          name={session.user.name}
        />
        <BackgroundRoutePrefetch />
        <Sidebar />
        <div className="md:pl-64">
          <TopBar stats={stats} githubStars={githubStars} />
          <main className="p-4 pb-20 md:p-8 md:pb-8">{children}</main>
        </div>
        <MobileNav />
      </div>
    );
  }

  // Not authenticated: minimal public layout
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";
  const redirectParam = pathname ? `?redirect=${encodeURIComponent(pathname)}` : "";

  return (
    <div className="min-h-screen bg-lingo-bg">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b-2 border-lingo-border bg-white px-4 md:px-6">
        <Link href="/" className="text-xl font-black text-lingo-green">
          OpenLingo
        </Link>
        <div className="flex items-center gap-3">
          <Link
            href={`/sign-in${redirectParam}`}
            className="rounded-xl px-3 py-1.5 text-sm font-bold text-lingo-text-light hover:bg-lingo-gray/50 transition-colors"
          >
            Sign In
          </Link>
          <Link
            href={`/sign-up${redirectParam}`}
            className="rounded-xl bg-lingo-green px-4 py-1.5 text-sm font-bold text-white border-b-2 border-lingo-green-dark hover:bg-lingo-green/90 transition-colors"
          >
            Sign Up
          </Link>
        </div>
      </header>
      <main className="p-4 pb-20 md:p-8 md:pb-8">
        <div className="mx-auto max-w-lg">{children}</div>
      </main>
    </div>
  );
}
