import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import { getUserStatsData } from "@/lib/actions/progress";
import { Sidebar } from "@/components/layout/sidebar";
import { TopBar } from "@/components/layout/top-bar";
import { MobileNav } from "@/components/layout/mobile-nav";

export default async function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  let stats = null;
  try {
    stats = await getUserStatsData();
  } catch {
    // User may not have stats yet
  }

  return (
    <div className="min-h-screen bg-lingo-bg">
      <Sidebar />
      <div className="md:pl-64">
        <TopBar stats={stats} />
        <main className="p-4 pb-20 md:p-8 md:pb-8">{children}</main>
      </div>
      <MobileNav />
    </div>
  );
}
