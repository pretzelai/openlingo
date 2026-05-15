import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { api, type Session } from "@/api/client";
import { Button } from "@/components/ui/Button";

export function useSession() {
  return useQuery({ queryKey: ["session"], queryFn: () => api<Session>("/api/auth/session") });
}

export function PublicLayout() {
  const { data } = useSession();
  return data ? <Shell publicMode /> : <MinimalPublic />;
}

function MinimalPublic() {
  const loc = useLocation();
  const redirect = loc.pathname !== "/" ? `?redirect=${encodeURIComponent(loc.pathname + loc.search)}` : "";
  return <div className="min-h-screen bg-lingo-bg">
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b-2 border-lingo-border bg-white px-4 md:px-6">
      <Link to="/" className="text-xl font-black text-lingo-green">OpenLingo</Link>
      <div className="flex items-center gap-2"><Link className="text-sm font-bold text-lingo-text-light" to={`/sign-in${redirect}`}>Sign In</Link><Link className="rounded-xl bg-lingo-green px-4 py-2 text-sm font-black text-white" to={`/sign-up${redirect}`}>Sign Up</Link></div>
    </header>
    <main className="mx-auto max-w-3xl p-4 md:p-8"><Outlet /></main>
  </div>;
}

export function AuthLayout() {
  const { data, isLoading } = useSession();
  const loc = useLocation();
  if (isLoading) return <Loading />;
  if (data) return <Navigate to={new URLSearchParams(loc.search).get("redirect") || "/chat"} replace />;
  return <div className="min-h-screen bg-lingo-bg flex items-center justify-center p-4"><Outlet /></div>;
}

export function AppLayout() {
  const { data, isLoading } = useSession();
  const loc = useLocation();
  if (isLoading) return <Loading />;
  if (!data) return <Navigate to={`/sign-in?redirect=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  return <Shell />;
}

function Shell({ publicMode = false }: { publicMode?: boolean }) {
  const { data } = useSession();
  const navigate = useNavigate();
  const qc = useQueryClient();
  async function signOut() {
    await api("/api/auth/sign-out", { method: "POST" });
    qc.clear();
    navigate("/");
  }
  return <div className="min-h-dvh bg-lingo-bg md:flex">
    <aside className="fixed inset-y-0 left-0 hidden w-64 border-r-2 border-lingo-border bg-white p-4 md:block">
      <Link to="/chat" className="mb-8 block text-2xl font-black text-lingo-green">OpenLingo</Link>
      <Nav />
      <div className="absolute bottom-4 left-4 right-4 text-xs text-lingo-text-light">{data?.user.email}<br/><button onClick={signOut} className="mt-2 font-bold text-lingo-red">Sign out</button></div>
    </aside>
    <div className="flex min-h-dvh flex-1 flex-col md:pl-64">
      <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b-2 border-lingo-border bg-white px-4 md:h-16">
        <Link to={data ? "/chat" : "/"} className="font-black text-lingo-green md:hidden">OpenLingo</Link>
        <div className="hidden md:block text-sm font-bold text-lingo-text-light">{publicMode ? "Shared content" : "Learn a language. Have fun."}</div>
        {data ? <Button variant="secondary" onClick={signOut} className="md:hidden">Out</Button> : <Link to="/sign-in" className="font-bold text-lingo-blue">Sign in</Link>}
      </header>
      <main className="flex-1 p-4 pb-24 md:p-8"><Outlet /></main>
      <MobileNav />
    </div>
  </div>;
}

function Nav() {
  const items = [["/chat","💬","Chat"],["/units","📚","Learn"],["/words","🧠","Words"],["/read","📖","Read"],["/settings","⚙️","Settings"]];
  return <nav className="space-y-2">{items.map(([to, icon, label]) => <NavLink key={to} to={to} className={({isActive}) => `flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-black ${isActive ? "bg-lingo-green/10 text-lingo-green" : "text-lingo-text-light hover:bg-lingo-gray/40"}`}><span>{icon}</span>{label}</NavLink>)}</nav>;
}

function MobileNav() {
  const items = [["/chat","💬"],["/units","📚"],["/words","🧠"],["/read","📖"],["/settings","⚙️"]];
  return <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-5 border-t-2 border-lingo-border bg-white md:hidden">{items.map(([to, icon]) => <NavLink key={to} to={to} className={({isActive}) => `py-3 text-center text-xl ${isActive ? "bg-lingo-green/10" : ""}`}>{icon}</NavLink>)}</nav>;
}

export function Loading() { return <div className="flex min-h-screen items-center justify-center bg-lingo-bg"><div className="h-8 w-8 animate-spin rounded-full border-4 border-lingo-green border-t-transparent" /></div>; }
