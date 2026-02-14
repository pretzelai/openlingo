"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/learn", label: "Learn", icon: "📚" },
  { href: "/review", label: "Review", icon: "🔄" },
  { href: "/words", label: "Words", icon: "🔤" },
  { href: "/prompts", label: "Prompts", icon: "✏️" },
  { href: "/profile", label: "Profile", icon: "👤" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-64 md:flex-col md:fixed md:inset-y-0 border-r-2 border-lingo-border bg-white">
      <div className="flex h-16 items-center px-6">
        <Link href="/learn" className="text-2xl font-black text-lingo-green">
          LingoClaw
        </Link>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-base font-bold transition-colors ${
                active
                  ? "bg-lingo-blue/10 text-lingo-blue border-2 border-lingo-blue/20"
                  : "text-lingo-text-light hover:bg-lingo-gray/50"
              }`}
            >
              <span className="text-xl">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
