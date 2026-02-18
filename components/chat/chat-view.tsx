"use client";

import { useChat } from "@ai-sdk/react";
import type { UIMessage } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { useRef, useEffect, useState, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChatMessage } from "./chat-message";
import { ThinkingMessage } from "./thinking-message";
import { createConversation, saveMessages } from "@/lib/actions/chat";
import { recordChatExerciseResult } from "@/lib/actions/srs";
import { updatePreferredModel } from "@/lib/actions/preferences";
import { AVAILABLE_MODELS } from "@/lib/ai/models";
import type { Exercise } from "@/lib/content/types";

interface ChatViewProps {
  language?: string;
  preferredModel: string;
  conversationId?: string;
  initialMessages?: UIMessage[];
}

export function ChatView({
  language,
  preferredModel,
  conversationId,
  initialMessages,
}: ChatViewProps) {
  const effectiveLanguage = language ?? "en";
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");
  const [model, setModel] = useState(preferredModel);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [completedExercises, setCompletedExercises] = useState<
    Record<string, { correct: boolean; answer: string }>
  >({});
  const [initialMessageIds] = useState(
    () => new Set((initialMessages ?? []).map((m) => m.id)),
  );
  const [chatId] = useState(() => conversationId ?? crypto.randomUUID());
  const convIdRef = useRef<string | null>(conversationId ?? null);

  const transport = useMemo(
    () => new DefaultChatTransport({ body: { language: effectiveLanguage, model } }),
    [effectiveLanguage, model],
  );

  const { messages, sendMessage, status } = useChat({
    transport,
    id: chatId,
    messages: initialMessages,
    onFinish: async ({ messages: allMessages, isError, isAbort }) => {
      if (isError || isAbort) return;

      if (convIdRef.current) {
        await saveMessages(convIdRef.current, allMessages);
      } else {
        const firstUserMsg = allMessages.find((m) => m.role === "user");
        const title = firstUserMsg
          ? (
              firstUserMsg.parts.find((p) => p.type === "text")?.text ??
              "New chat"
            ).slice(0, 50)
          : "New chat";
        const newId = await createConversation(effectiveLanguage, title, allMessages);
        convIdRef.current = newId;
        window.history.replaceState(null, "", `/chat/${newId}`);
        router.refresh();
      }
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  // Scroll management
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "instant") => {
    endRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      setIsAtBottom(scrollHeight - scrollTop - clientHeight < 40);
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-scroll on new content when user is at bottom
  useEffect(() => {
    if (isAtBottom) {
      scrollToBottom();
    }
  }, [messages, isAtBottom, scrollToBottom]);

  // Auto-send onboarding message for new users (no target language set)
  const onboardingSent = useRef(false);
  useEffect(() => {
    if (!language && !onboardingSent.current && !initialMessages?.length) {
      onboardingSent.current = true;
      sendMessage({ text: "I am a new user, I need onboarding" });
    }
  }, [language, initialMessages, sendMessage]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Auto-resize textarea
  const adjustHeight = useCallback(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = "44px";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [input, adjustHeight]);

  function submitForm() {
    if (!input.trim() || isLoading) return;
    sendMessage({ text: input.trim() });
    setInput("");
  }

  function handleExerciseComplete(
    toolCallId: string,
    correct: boolean,
    userAnswer: string,
    exercise: Exercise,
  ) {
    setCompletedExercises((prev) => ({
      ...prev,
      [toolCallId]: { correct, answer: userAnswer },
    }));

    // Record SRS practice (fire-and-forget) — skip for flashcard-review
    // since it handles its own SRS update via reviewCard
    if (exercise.type !== "flashcard-review") {
      recordChatExerciseResult(exercise, correct, effectiveLanguage).catch(() => {});
    }

    sendMessage({
      text: correct
        ? `Exercise result: CORRECT. My answer: "${userAnswer}". (SRS already updated — do not run an SRS update query.)`
        : `Exercise result: INCORRECT. My answer: "${userAnswer}". (SRS already updated — do not run an SRS update query.)`,
    });
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submitForm();
    }
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col">
      {/* Messages area */}
      <div className="relative flex-1">
        <div
          ref={containerRef}
          className="absolute inset-0 overflow-y-auto touch-pan-y"
        >
          <div className="mx-auto flex min-w-0 max-w-3xl flex-col gap-4 px-2 py-4 md:gap-6 md:px-4">
            {messages.length === 0 && (
              <Greeting
                language={effectiveLanguage}
                onSend={(text) => sendMessage({ text })}
              />
            )}

            {messages.map((message, index) => (
              <ChatMessage
                key={message.id}
                message={message}
                language={effectiveLanguage}
                isLoading={
                  status === "streaming" && messages.length - 1 === index
                }
                completedExercises={completedExercises}
                onExerciseComplete={handleExerciseComplete}
                autoplayAudio={!initialMessageIds.has(message.id)}
              />
            ))}

            {status === "submitted" && <ThinkingMessage />}

            <div ref={endRef} className="min-h-[24px] shrink-0" />
          </div>
        </div>

        {/* Scroll to bottom button */}
        <button
          aria-label="Scroll to bottom"
          className={`absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border-2 border-lingo-border bg-white p-2 shadow-lg transition-all hover:bg-lingo-gray ${
            isAtBottom
              ? "pointer-events-none scale-0 opacity-0"
              : "pointer-events-auto scale-100 opacity-100"
          }`}
          onClick={() => scrollToBottom("smooth")}
          type="button"
        >
          <svg
            className="h-4 w-4 text-lingo-text"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 14l-7 7m0 0l-7-7m7 7V3"
            />
          </svg>
        </button>
      </div>

      {/* Input area */}
      <div className="sticky bottom-0 z-10 bg-lingo-bg px-2 pb-3 pt-1 md:px-4 md:pb-4">
        <div className="mb-1.5 flex justify-end">
          <select
            value={model}
            onChange={(e) => {
              const value = e.target.value;
              setModel(value);
              updatePreferredModel(value);
            }}
            className="rounded-lg border border-lingo-border bg-white px-2 py-1 text-xs text-lingo-text-light"
          >
            {AVAILABLE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitForm();
          }}
          className="flex items-end gap-2 rounded-xl border-2 border-lingo-border bg-white p-2 shadow-sm transition-all duration-200 focus-within:border-lingo-blue hover:border-lingo-text-light/30"
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Send a message..."
            rows={1}
            className="flex-1 resize-none border-none bg-transparent px-2 py-1.5 text-sm text-lingo-text placeholder:text-lingo-text-light/50 focus:outline-none"
            style={{ height: "44px", maxHeight: "200px" }}
          />
          {isLoading ? (
            <button
              type="button"
              onClick={() => {
                /* stop not needed for now */
              }}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lingo-text text-white transition-colors hover:bg-lingo-text/80"
            >
              <svg
                className="h-3.5 w-3.5"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <rect x="6" y="6" width="12" height="12" rx="2" />
              </svg>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lingo-green text-white transition-colors hover:bg-lingo-green/90 disabled:bg-lingo-gray disabled:text-lingo-text-light"
            >
              <svg
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2.5}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18"
                />
              </svg>
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

const LANG_FLAGS: Record<string, string> = {
  de: "\u{1F1E9}\u{1F1EA}",
  fr: "\u{1F1EB}\u{1F1F7}",
  es: "\u{1F1EA}\u{1F1F8}",
  it: "\u{1F1EE}\u{1F1F9}",
  pt: "\u{1F1F5}\u{1F1F9}",
  ru: "\u{1F1F7}\u{1F1FA}",
  ar: "\u{1F1F8}\u{1F1E6}",
  hi: "\u{1F1EE}\u{1F1F3}",
  ko: "\u{1F1F0}\u{1F1F7}",
  zh: "\u{1F1E8}\u{1F1F3}",
  ja: "\u{1F1EF}\u{1F1F5}",
  en: "\u{1F1EC}\u{1F1E7}",
};

const LANG_NAMES: Record<string, string> = {
  de: "German",
  fr: "French",
  es: "Spanish",
  it: "Italian",
  pt: "Portuguese",
  ru: "Russian",
  ar: "Arabic",
  hi: "Hindi",
  ko: "Korean",
  zh: "Mandarin",
  ja: "Japanese",
  en: "English",
};

function Greeting({
  language,
  onSend,
}: {
  language: string;
  onSend: (text: string) => void;
}) {
  const flag = LANG_FLAGS[language] ?? "\u{1F30D}";
  const name = LANG_NAMES[language] ?? language;

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-lingo-green/10 ring-1 ring-lingo-green/20 mb-4">
        <span className="text-2xl">{flag}</span>
      </div>
      <h2 className="text-lg font-bold text-lingo-text mb-2">AI Tutor</h2>
      <p className="text-sm text-lingo-text-light max-w-sm leading-relaxed">
        Practice vocabulary, review due words, or create custom lessons. Your
        current language is {name}.
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {[
          "Let's practice!",
          "How many words are due?",
          "Teach me something new",
        ].map((label) => (
          <button
            key={label}
            type="button"
            onClick={() => onSend(label)}
            className="rounded-full border-2 border-lingo-border bg-white px-4 py-2 text-xs font-medium text-lingo-text transition-colors hover:border-lingo-blue hover:bg-lingo-blue/5"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
