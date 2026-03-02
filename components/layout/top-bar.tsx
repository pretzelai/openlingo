"use client";

import { useRouter } from "next/navigation";
import { signOut, useSession } from "@/lib/auth-client";
import { FeedbackButton } from "@/components/feedback/feedback-button";

interface TopBarProps {
  stats?: {
    currentStreak: number;
    wordsLearned: number;
  } | null;
  githubStars?: number | null;
}

export function TopBar({ stats, githubStars }: TopBarProps) {
  const router = useRouter();
  const { data: session } = useSession();

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b-2 border-lingo-border bg-white px-4 md:px-6">
      <div className="md:hidden">
        <span className="text-xl font-black text-lingo-green">OpenLingo</span>
      </div>

      {/* Stats */}
      {stats && (
        <div className="flex items-center gap-4 ml-4">
          <div className="flex items-center gap-1">
            <span
              className={`text-base ${stats.wordsLearned > 0 ? "" : "grayscale opacity-40"}`}
            >
              📚
            </span>
            <span
              className={`text-sm font-bold ${stats.wordsLearned > 0 ? "text-lingo-blue" : "text-lingo-gray-dark"}`}
            >
              {stats.wordsLearned}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <span
              className={`text-base ${stats.currentStreak > 0 ? "" : "grayscale opacity-40"}`}
            >
              🔥
            </span>
            <span
              className={`text-sm font-bold ${stats.currentStreak > 0 ? "text-lingo-orange" : "text-lingo-gray-dark"}`}
            >
              {stats.currentStreak}
            </span>
          </div>
        </div>
      )}

      <div className="flex-1" />

      {/* Feedback */}
      <FeedbackButton className="hidden sm:inline-flex items-center rounded-xl bg-lingo-blue px-4 py-1.5 text-sm font-bold text-white border-b-4 border-lingo-blue-dark hover:bg-lingo-blue/90 active:border-b-0 active:mt-1 transition-all duration-100 cursor-pointer mr-3" />

      {/* GitHub Link */}
      <a
        href="https://github.com/pretzelai/openlingo"
        target="_blank"
        rel="noopener noreferrer"
        className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-lingo-border bg-white px-3 py-1 text-lingo-text-light hover:text-lingo-text hover:border-lingo-text-light transition-colors"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
        </svg>
        {githubStars != null && (
          <>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="text-yellow-500"
            >
              <path d="M12 .587l3.668 7.568 8.332 1.151-6.064 5.828 1.48 8.279-7.416-3.967-7.417 3.967 1.481-8.279-6.064-5.828 8.332-1.151z" />
            </svg>
            <span className="text-xs font-semibold">
              {githubStars >= 1000
                ? `${(githubStars / 1000).toFixed(1)}k`
                : githubStars.toLocaleString()}
            </span>
          </>
        )}
      </a>

      <div className="flex items-center gap-4 ml-4">
        {session?.user && (
          <span className="text-sm font-bold text-lingo-text hidden sm:inline">
            {session.user.name}
          </span>
        )}
        <button
          onClick={handleSignOut}
          className="rounded-xl px-3 py-1.5 text-sm font-bold text-lingo-text-light hover:bg-lingo-gray/50 transition-colors"
        >
          Sign Out
        </button>
      </div>
    </header>
  );
}
