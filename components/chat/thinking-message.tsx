"use client";

export function ThinkingMessage() {
  return (
    <div
      className="group/message w-full animate-in fade-in duration-300"
      data-role="assistant"
    >
      <div className="flex items-start justify-start gap-3">
        <div className="-mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lingo-green/10 ring-1 ring-lingo-green/20">
          <span className="animate-pulse text-sm">🤖</span>
        </div>

        <div className="flex w-full flex-col gap-2">
          <div className="flex items-center gap-1 text-sm text-lingo-text-light">
            <span className="animate-pulse">Thinking</span>
            <span className="inline-flex">
              <span className="animate-bounce [animation-delay:0ms]">.</span>
              <span className="animate-bounce [animation-delay:150ms]">.</span>
              <span className="animate-bounce [animation-delay:300ms]">.</span>
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
