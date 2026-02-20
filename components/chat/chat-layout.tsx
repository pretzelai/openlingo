"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { deleteConversation } from "@/lib/actions/chat";

type ConversationSummary = {
  id: string;
  title: string;
  language: string;
  updatedAt: Date;
};

interface ChatLayoutProps {
  conversations: ConversationSummary[];
  children: React.ReactNode;
}

const MONTH_NAMES = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

function formatDate(date: Date) {
  const d = new Date(date);
  const day = d.getDate();
  const month = MONTH_NAMES[d.getMonth()];
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}-${month}-${hours}:${minutes}`;
}

export function ChatLayout({ conversations, children }: ChatLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Already sorted desc by updatedAt from the DB query
  const sorted = conversations;

  function handleDelete(id: string) {
    startTransition(async () => {
      await deleteConversation(id);
      if (pathname === `/chat/${id}`) {
        router.push("/chat");
      }
      router.refresh();
    });
  }

  const sidebar = (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-3">
        <Link
          href="/chat"
          onClick={() => setSidebarOpen(false)}
          className="flex items-center gap-2 rounded-lg border-2 border-lingo-border bg-white px-3 py-2 text-sm font-bold text-lingo-text transition-colors hover:border-lingo-blue hover:bg-lingo-blue/5"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
          </svg>
          New chat
        </Link>
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="rounded-lg p-1.5 text-lingo-text-light hover:bg-lingo-gray/50 md:hidden"
        >
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        {sorted.length === 0 && (
          <p className="px-2 py-8 text-center text-xs text-lingo-text-light">
            No conversations yet
          </p>
        )}
        {sorted.map((conv) => {
          const active = pathname === `/chat/${conv.id}`;
          return (
            <div
              key={conv.id}
              className={`group relative flex items-center rounded-lg transition-colors ${
                active
                  ? "bg-lingo-blue/10 text-lingo-blue"
                  : "text-lingo-text hover:bg-lingo-gray/50"
              }`}
            >
              <span className="shrink-0 px-2 py-2 text-[10px] leading-tight text-lingo-text-light">
                {formatDate(conv.updatedAt)}
              </span>
              <Link
                href={`/chat/${conv.id}`}
                onClick={() => setSidebarOpen(false)}
                className="min-w-0 flex-1 py-2 pr-1 text-sm font-medium truncate"
              >
                {conv.title}
              </Link>
              <button
                type="button"
                onClick={() => handleDelete(conv.id)}
                disabled={isPending}
                className="mr-1 shrink-0 rounded p-1 text-lingo-text-light opacity-0 transition-opacity hover:bg-red-50 hover:text-red-500 group-hover:opacity-100"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );

  return (
    <div className="-m-4 md:-m-8 md:-mb-8 relative flex h-[calc(100dvh-9rem)] md:h-[calc(100vh-4rem)]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={`fixed inset-y-0 left-0 z-40 w-72 border-r-2 border-lingo-border bg-white transition-transform md:relative md:z-0 md:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {sidebar}
      </div>

      {/* Main content */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile toggle */}
        <div className="flex items-center px-2 py-1 md:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-lingo-text-light hover:bg-lingo-gray/50"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>

        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
