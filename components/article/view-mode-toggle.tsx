"use client";

export type ViewMode = "target" | "bridge" | "source";

interface ViewModeToggleProps {
  mode: ViewMode;
  onModeChange: (mode: ViewMode) => void;
  targetLanguage: string;
  hasBridge?: boolean;
}

export function ViewModeToggle({
  mode,
  onModeChange,
  targetLanguage,
  hasBridge = true,
}: ViewModeToggleProps) {
  const modes: { value: ViewMode; label: string }[] = [
    { value: "target", label: targetLanguage },
    ...(hasBridge ? [{ value: "bridge" as ViewMode, label: "English" }] : []),
    { value: "source", label: "Source" },
  ];

  return (
    <div className="inline-flex rounded-xl border-2 border-lingo-border bg-white p-1">
      {modes.map((m) => (
        <button
          key={m.value}
          type="button"
          onClick={() => onModeChange(m.value)}
          className={`rounded-lg px-3 py-1.5 text-xs font-bold transition-colors ${
            mode === m.value
              ? "bg-lingo-blue text-white"
              : "text-lingo-text-light hover:bg-lingo-gray/50"
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  );
}
