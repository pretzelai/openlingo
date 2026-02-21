"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useMobileKeyboardOpen } from "@/hooks/use-mobile-keyboard-open";

const navItems = [
  { href: "/chat", label: "Chat", icon: "💬" },
  { href: "/units", label: "Units", icon: "📚" },
  { href: "/words", label: "Words", icon: "🔤" },
  { href: "/read", label: "Read", icon: "📖" },
  { href: "/settings", label: "Settings", icon: "⚙️" },
];

export function MobileNav() {
  const pathname = usePathname();
  const isKeyboardOpen = useMobileKeyboardOpen();
  const [chatDraft, setChatDraft] = useState("");
  const isChatRoute = pathname === "/chat" || pathname.startsWith("/chat/");

  useEffect(() => {
    const handleDraftChange = (event: Event) => {
      const customEvent = event as CustomEvent<{ text?: string }>;
      setChatDraft(customEvent.detail?.text ?? "");
    };

    window.addEventListener("chat-draft-change", handleDraftChange as EventListener);
    return () => {
      window.removeEventListener(
        "chat-draft-change",
        handleDraftChange as EventListener,
      );
    };
  }, []);

  if (isKeyboardOpen && isChatRoute) {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-lingo-border/70 bg-white/95 px-3 py-1 md:hidden">
        <p className="truncate text-[11px] text-lingo-text-light">
          {chatDraft || "\u2009"}
        </p>
      </div>
    );
  }

  if (isKeyboardOpen) return null;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-30 flex md:hidden border-t-2 border-lingo-border bg-white">
      {navItems.map((item) => {
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-bold transition-colors ${
              active ? "text-lingo-blue" : "text-lingo-text-light"
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
