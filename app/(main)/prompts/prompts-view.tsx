"use client";

import { useState } from "react";
import { PromptEditor } from "./prompt-editor";
import { MemoryEditor } from "./memory-editor";
import type { PromptWithOverride } from "@/lib/actions/prompts";

export function PromptsView({
  prompts,
  initialMemory,
}: {
  prompts: PromptWithOverride[];
  initialMemory: string;
}) {
  const [filter, setFilter] = useState("all");

  const filtered =
    filter === "all" ? prompts : prompts.filter((p) => p.id === filter);

  return (
    <div className="mx-auto max-w-2xl py-6">
      <h1 className="text-2xl font-black text-lingo-text mb-1">AI Prompts</h1>
      <p className="text-sm text-lingo-text-light font-bold mb-6">
        Customize the prompts used by AI features throughout the app.
      </p>

      {/* Filter dropdown */}
      <div className="mb-6">
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full rounded-xl border-2 border-lingo-border bg-white px-4 py-2.5 text-sm font-bold text-lingo-text focus:outline-none focus:border-lingo-blue transition-colors"
        >
          <option value="all">All prompts</option>
          {prompts.map((p) => (
            <option key={p.id} value={p.id}>
              {p.displayName}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-4">
        {/* Memory editor — always shown when "all", or could be its own filter */}
        {filter === "all" && (
          <MemoryEditor initialValue={initialMemory} />
        )}

        {filtered.map((p) => (
          <PromptEditor key={p.id} prompt={p} />
        ))}
      </div>
    </div>
  );
}
