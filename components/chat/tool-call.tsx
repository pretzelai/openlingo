"use client";

import { useState } from "react";

const TOOL_LABELS: Record<string, string> = {
  getDueCards: "Fetching due cards",
  getSrsStats: "Checking learning stats",
  reviewCard: "Updating SRS card",
  addWordToSrs: "Adding word to deck",
  addWordsByLevel: "Adding words by level",
  lookupWord: "Looking up word",
  removeWord: "Removing word",
  listCards: "Listing cards",
  readMemory: "Reading memory",
  writeMemory: "Saving to memory",
};

const STATE_LABELS: Record<string, string> = {
  "input-streaming": "Pending",
  "input-available": "Running",
  "output-available": "Completed",
  "output-error": "Error",
};

interface ToolCallProps {
  toolName: string;
  state: string;
  input?: Record<string, unknown>;
  output?: unknown;
}

export function ToolCall({ toolName, state, input, output }: ToolCallProps) {
  const [isOpen, setIsOpen] = useState(false);

  const label = TOOL_LABELS[toolName] ?? toolName;
  const stateLabel = STATE_LABELS[state] ?? state;
  const isRunning =
    state === "input-streaming" || state === "input-available";
  const isComplete = state === "output-available";
  const isError = state === "output-error";

  return (
    <div className="w-full rounded-lg border-2 border-lingo-border overflow-hidden">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-lingo-gray/30 transition-colors"
      >
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {/* Icon */}
          {isRunning && (
            <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-lingo-text-light/30 border-t-lingo-blue" />
          )}
          {isComplete && (
            <svg
              className="h-3.5 w-3.5 shrink-0 text-lingo-green"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M5 13l4 4L19 7"
              />
            </svg>
          )}
          {isError && (
            <svg
              className="h-3.5 w-3.5 shrink-0 text-lingo-red"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          )}

          <span className="truncate text-xs font-medium text-lingo-text">
            {label}
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
              isRunning
                ? "bg-lingo-blue/10 text-lingo-blue"
                : isComplete
                  ? "bg-lingo-green/10 text-lingo-green"
                  : isError
                    ? "bg-red-50 text-lingo-red"
                    : "bg-lingo-gray text-lingo-text-light"
            }`}
          >
            {stateLabel}
          </span>
          <svg
            className={`h-3.5 w-3.5 text-lingo-text-light transition-transform ${isOpen ? "rotate-180" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="border-t-2 border-lingo-border">
          {input && Object.keys(input).length > 0 && (
            <div className="px-3 py-2">
              <h4 className="text-[10px] font-medium uppercase tracking-wide text-lingo-text-light mb-1">
                Parameters
              </h4>
              <pre className="overflow-x-auto rounded-md bg-lingo-gray/50 p-2 font-mono text-[11px] text-lingo-text">
                {JSON.stringify(input, null, 2)}
              </pre>
            </div>
          )}
          {isComplete && output != null && (
            <div className="px-3 py-2 border-t border-lingo-border/50">
              <h4 className="text-[10px] font-medium uppercase tracking-wide text-lingo-text-light mb-1">
                Result
              </h4>
              <pre className="overflow-x-auto rounded-md bg-lingo-green/5 p-2 font-mono text-[11px] text-lingo-text">
                {JSON.stringify(output as Record<string, unknown>, null, 2)}
              </pre>
            </div>
          )}
          {isError && (
            <div className="px-3 py-2 border-t border-lingo-border/50">
              <div className="rounded-md bg-red-50 p-2 text-xs text-lingo-red">
                Tool execution failed
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
