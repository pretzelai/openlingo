import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "@/api/client";

export function Landing() {
  const { data } = useQuery({ queryKey: ["github-stars"], queryFn: () => api<{stars: number | null}>("/api/github-stars") });
  return <div className="mx-auto max-w-4xl py-12 text-center">
    <div className="mb-6 inline-flex rounded-full border-2 border-lingo-border bg-white px-4 py-2 text-xs font-black text-lingo-text-light">Open-source AI language learning {data?.stars ? `· ⭐ ${data.stars}` : ""}</div>
    <h1 className="text-5xl font-black tracking-tight text-lingo-text md:text-7xl">Learn a language with an AI tutor.</h1>
    <p className="mx-auto mt-6 max-w-2xl text-lg text-lingo-text-light">Practice conversations, complete interactive lessons, review words with SRS, and translate real articles at your level.</p>
    <div className="mt-8 flex justify-center gap-3"><Link to="/sign-up" className="rounded-xl bg-lingo-green px-6 py-3 font-black text-white shadow-[0_3px_0_0] shadow-lingo-green-dark">Start learning</Link><Link to="/sign-in" className="rounded-xl border-2 border-lingo-border bg-white px-6 py-3 font-black">Sign in</Link></div>
    <div className="mt-14 grid gap-4 md:grid-cols-3">{[
      ["💬","AI Chat Tutor","Practice naturally and generate lessons on demand."],
      ["🧠","Spaced Repetition","Review words exactly when you need them."],
      ["📖","Translated Reading","Turn articles into graded reading material."],
    ].map(([icon,title,body]) => <div key={title} className="rounded-2xl border-2 border-lingo-border bg-white p-6 text-left"><div className="text-3xl">{icon}</div><h2 className="mt-4 font-black">{title}</h2><p className="mt-2 text-sm text-lingo-text-light">{body}</p></div>)}</div>
  </div>;
}
