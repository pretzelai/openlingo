"use client";

import { useState, useTransition } from "react";
import { savePrompt, resetPrompt, type PromptWithOverride } from "@/lib/actions/prompts";

export function PromptEditor({ prompt }: { prompt: PromptWithOverride }) {
  const [value, setValue] = useState(
    prompt.customTemplate ?? prompt.defaultTemplate
  );
  const [isCustomized, setIsCustomized] = useState(
    prompt.customTemplate !== null
  );
  const [saving, startSave] = useTransition();
  const [resetting, startReset] = useTransition();

  const isTall = prompt.id === "unit-generation";

  function handleSave() {
    startSave(async () => {
      await savePrompt(prompt.id, value);
      setIsCustomized(true);
    });
  }

  function handleReset() {
    startReset(async () => {
      await resetPrompt(prompt.id);
      setValue(prompt.defaultTemplate);
      setIsCustomized(false);
    });
  }

  return (
    <div className="rounded-2xl border-2 border-lingo-border bg-white p-5">
      <div className="flex items-start justify-between mb-1">
        <h2 className="text-lg font-black text-lingo-text">
          {prompt.displayName}
        </h2>
        {isCustomized && (
          <span className="text-xs font-bold text-lingo-blue bg-lingo-blue/10 px-2 py-0.5 rounded-full">
            Customized
          </span>
        )}
      </div>
      <p className="text-sm text-lingo-text-light font-bold mb-3">
        {prompt.description}
      </p>

      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className={`w-full p-3 text-sm font-mono rounded-xl border-2 border-lingo-border bg-lingo-gray/20 resize-none focus:outline-none focus:border-lingo-blue ${
          isTall ? "h-64" : "h-28"
        }`}
      />

      <div className="mt-2 flex flex-wrap gap-1.5">
        {prompt.variables.map((v) => (
          <code
            key={v}
            className="px-1.5 py-0.5 bg-lingo-gray rounded text-xs font-bold text-lingo-text-light"
          >
            {`{${v}}`}
          </code>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 bg-lingo-blue text-white text-sm font-bold rounded-xl border-b-4 border-lingo-blue/70 active:border-b-0 active:mt-1 transition-all disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save"}
        </button>
        {isCustomized && (
          <button
            onClick={handleReset}
            disabled={resetting}
            className="px-4 py-2 text-sm font-bold text-lingo-text-light hover:text-lingo-text rounded-xl transition-colors disabled:opacity-50"
          >
            {resetting ? "Resetting..." : "Reset to default"}
          </button>
        )}
      </div>
    </div>
  );
}
