"use client";

import { useTransition } from "react";
import { updatePreferredModel } from "@/lib/actions/preferences";
import { AVAILABLE_MODELS } from "@/lib/ai/models";

interface ModelPickerProps {
  currentModel: string;
}

export function ModelPicker({ currentModel }: ModelPickerProps) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center justify-between">
      <div>
        <span className="text-lingo-text-light">AI Model</span>
      </div>
      <select
        value={currentModel}
        disabled={isPending}
        onChange={(e) => {
          const value = e.target.value;
          if (!value) return;
          startTransition(() => updatePreferredModel(value));
        }}
        className="rounded-lg border-2 border-lingo-border bg-lingo-card px-3 py-1.5 text-sm font-bold text-lingo-text disabled:opacity-50"
      >
        {AVAILABLE_MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
    </div>
  );
}
