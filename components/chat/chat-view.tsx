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

import type { Exercise } from "@/lib/content/types";
import { useAudio } from "@/hooks/use-audio";
import { useIsMobile } from "@/hooks/use-media-query";
import { useMobileKeyboardOpen } from "@/hooks/use-mobile-keyboard-open";
import { useVADRecorder } from "@/hooks/use-vad-recorder";
import { VoiceWaveform } from "./voice-waveform";

interface ChatViewProps {
  language?: string;
  preferredModel: string;
  availableModels: { id: string; label: string; provider: string }[];
  conversationId?: string;
  initialMessages?: UIMessage[];
  initialPrompt?: string;
}

export function ChatView({
  language,
  preferredModel,
  availableModels,
  conversationId,
  initialMessages,
  initialPrompt,
}: ChatViewProps) {
  const effectiveLanguage = language ?? "en";
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [input, setInput] = useState("");
  const [model, setModel] = useState(preferredModel);
  const [interactionMode, setInteractionMode] = useState<"text" | "voice">("text");
  const [lastVoiceTranscript, setLastVoiceTranscript] = useState<string | null>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const isMobile = useIsMobile();
  const isKeyboardOpen = useMobileKeyboardOpen();
  const [completedExercises, setCompletedExercises] = useState<
    Record<string, { correct: boolean; answer: string }>
  >({});
  const [initialMessageIds] = useState(
    () => new Set((initialMessages ?? []).map((m) => m.id)),
  );
  const [chatId] = useState(() => conversationId ?? crypto.randomUUID());
  const convIdRef = useRef<string | null>(conversationId ?? null);
  const pendingVoiceReplyRef = useRef(false);

  const {
    play: playAssistantAudio,
    stop: stopAssistantAudio,
    loading: assistantAudioLoading,
  } = useAudio();

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        body: { language: effectiveLanguage, model },
      }),
    [effectiveLanguage, model],
  );

  const { messages, sendMessage, status } = useChat({
    transport,
    id: chatId,
    messages: initialMessages,
    onFinish: async ({ messages: allMessages, isError, isAbort }) => {
      if (isError || isAbort) {
        pendingVoiceReplyRef.current = false;
        return;
      }

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
        const newId = await createConversation(
          effectiveLanguage,
          title,
          allMessages,
        );
        convIdRef.current = newId;
        router.replace(`/chat/${newId}`);
      }

      if (pendingVoiceReplyRef.current) {
        pendingVoiceReplyRef.current = false;
        const latestAssistant = [...allMessages]
          .reverse()
          .find((m) => m.role === "assistant");

        if (latestAssistant) {
          const speakable = getSpeakableAssistantText(latestAssistant);
          if (speakable) {
            playAssistantAudio(speakable, effectiveLanguage).catch(() => {});
          }
        }
      }
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  const handleVoiceTranscription = useCallback(
    (text: string) => {
      const spokenText = text.trim();
      if (!spokenText) return;

      setLastVoiceTranscript(spokenText);
      if (isLoading) return;

      pendingVoiceReplyRef.current = true;
      sendMessage({ text: spokenText });
    },
    [isLoading, sendMessage],
  );

  const {
    isSupported: isVoiceSupported,
    error: voiceError,
    level: voiceLevel,
    isRecording: isVoiceRecording,
    isProcessing: isVoiceProcessing,
    start: startVoiceRecording,
    stop: stopVoiceRecording,
    cancel: cancelVoiceRecording,
  } = useVADRecorder({
    language: effectiveLanguage,
    silenceMs: 2000,
    onTranscription: handleVoiceTranscription,
  });

  useEffect(() => {
    if (interactionMode !== "voice") {
      cancelVoiceRecording();
    }
  }, [cancelVoiceRecording, interactionMode]);

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

  // Scroll to bottom when mobile keyboard opens so input stays visible
  const prevKeyboardOpen = useRef(false);
  useEffect(() => {
    if (isKeyboardOpen && !prevKeyboardOpen.current) {
      // Small delay to let the viewport resize settle
      setTimeout(() => scrollToBottom(), 100);
    }
    prevKeyboardOpen.current = isKeyboardOpen;
  }, [isKeyboardOpen, scrollToBottom]);

  // Auto-send initial prompt (e.g. from "New Unit" / "New Article" buttons)
  const promptSent = useRef(false);
  useEffect(() => {
    if (
      initialPrompt &&
      !promptSent.current &&
      !initialMessages?.length &&
      language
    ) {
      promptSent.current = true;
      sendMessage({ text: initialPrompt });
    }
  }, [initialPrompt, initialMessages, language, sendMessage]);

  // Focus input on mount
  useEffect(() => {
    if (!isMobile) {
      inputRef.current?.focus();
    }
  }, [isMobile]);

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
      recordChatExerciseResult(exercise, correct, effectiveLanguage).catch(
        () => {},
      );
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

  const voiceBusy = isLoading || isVoiceProcessing || assistantAudioLoading;

  function getVoiceStatusLabel() {
    if (!isVoiceSupported) return "Voice mode is not supported in this browser.";
    if (assistantAudioLoading) return "Preparing assistant audio...";
    if (isLoading) return "Assistant is replying...";
    if (isVoiceProcessing) return "Transcribing...";
    if (isVoiceRecording) return "Listening... pause for 2 seconds to send.";
    return "Tap the microphone to start speaking.";
  }

  function handleVoiceButton() {
    if (!isVoiceSupported) return;
    if (isVoiceRecording) {
      stopVoiceRecording();
      return;
    }
    stopAssistantAudio();
    startVoiceRecording();
  }

  return (
    <div className="mx-auto flex h-full max-w-3xl flex-col">
      {/* Messages area */}
      <div className="relative flex-1">
        <div
          ref={containerRef}
          className="absolute inset-0 overflow-y-auto overflow-x-hidden touch-pan-y"
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

            {(status === "submitted" ||
              (status === "streaming" &&
                (() => {
                  const last = messages[messages.length - 1];
                  if (!last || last.role !== "assistant") return false;
                  const lastPart = last.parts[last.parts.length - 1] as
                    | { type: string; state?: string }
                    | undefined;
                  return (
                    lastPart?.type?.startsWith("tool-") &&
                    lastPart.state === "output-available"
                  );
                })())) && <ThinkingMessage />}

            <div ref={endRef} className="min-h-[24px] shrink-0" />
          </div>
        </div>

        {/* Scroll to bottom button */}
        <button
          aria-label="Scroll to bottom"
          className={`absolute bottom-4 left-1/2 z-10 -translate-x-1/2 rounded-full border-2 border-lingo-border bg-white p-2 shadow-lg transition-all hover:bg-lingo-gray ${
            isAtBottom || isKeyboardOpen
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
      <div
        className={`sticky bottom-0 z-10 bg-lingo-bg px-2 pb-3 pt-1 transition-all md:px-4 md:pb-4 ${
          isKeyboardOpen ? "pb-2 pt-0.5" : ""
        }`}
      >
        <div className={`mb-1.5 items-center justify-between gap-2 ${isKeyboardOpen ? "hidden" : "flex"}`}>
          <div className="inline-flex rounded-lg border border-lingo-border bg-white p-0.5">
            <button
              type="button"
              onClick={() => setInteractionMode("text")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                interactionMode === "text"
                  ? "bg-lingo-blue text-white"
                  : "text-lingo-text-light hover:bg-lingo-gray"
              }`}
            >
              Text
            </button>
            <button
              type="button"
              onClick={() => setInteractionMode("voice")}
              className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                interactionMode === "voice"
                  ? "bg-lingo-blue text-white"
                  : "text-lingo-text-light hover:bg-lingo-gray"
              }`}
            >
              Voice
            </button>
          </div>

          <select
            value={model}
            onChange={(e) => {
              const value = e.target.value;
              setModel(value);
              updatePreferredModel(value);
            }}
            className="rounded-lg border border-lingo-border bg-white px-2 py-1 text-xs text-lingo-text-light"
          >
            {availableModels.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </div>

        {interactionMode === "text" ? (
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
              className="flex-1 resize-none border-none bg-transparent px-2 py-1.5 text-base text-lingo-text placeholder:text-lingo-text-light/50 focus:outline-none md:text-sm"
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
        ) : (
          <div className="rounded-xl border-2 border-lingo-border bg-white p-3 shadow-sm">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleVoiceButton}
                disabled={!isVoiceSupported || voiceBusy}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-b-4 transition-all ${
                  isVoiceRecording
                    ? "animate-pulse border-red-700 bg-lingo-red text-white"
                    : "border-lingo-green-dark bg-lingo-green text-white hover:bg-lingo-green/90 active:mt-1 active:border-b-0"
                } disabled:border-lingo-border disabled:bg-lingo-gray disabled:text-lingo-text-light`}
              >
                {isVoiceRecording ? (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                    <rect x="6" y="6" width="12" height="12" rx="2" />
                  </svg>
                ) : (
                  <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                  </svg>
                )}
              </button>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-lingo-text">{getVoiceStatusLabel()}</p>
                <p className="text-xs text-lingo-text-light">
                  Voice turns auto-send after 2s of silence.
                </p>
              </div>

              <VoiceWaveform
                level={voiceLevel}
                active={isVoiceRecording}
                className="w-24 shrink-0 md:w-28"
              />
            </div>

            {lastVoiceTranscript && (
              <p className="mt-2 truncate text-xs text-lingo-text-light">
                You said: {lastVoiceTranscript}
              </p>
            )}

            {voiceError && (
              <p className="mt-2 text-xs text-lingo-red">{voiceError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function getSpeakableAssistantText(message: UIMessage): string {
  const text = message.parts
    .filter((part): part is { type: "text"; text: string } => {
      return part.type === "text" && typeof (part as { text?: unknown }).text === "string";
    })
    .map((part) => part.text)
    .join("\n");

  const cleaned = text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/!\[[^\]]*\]\([^)]+\)/g, " ")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^>\s?/gm, "")
    .replace(/^[-*]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned.slice(0, 4000);
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
          {
            label: "Make a new learning unit",
            prompt: "I want to create a new personalised unit",
          },
          {
            label: "Translate an article",
            prompt: "I want to create a new translated article",
          },
          { label: "Let's practice!", prompt: "Let's practice!" },
          {
            label: "How many words are due?",
            prompt: "How many words are due?",
          },
          { label: "Teach me something new", prompt: "Teach me something new" },
        ].map(({ label, prompt }) => (
          <button
            key={label}
            type="button"
            onClick={() => onSend(prompt)}
            className="rounded-full border-2 border-lingo-border bg-white px-4 py-2 text-xs font-medium text-lingo-text transition-colors hover:border-lingo-blue hover:bg-lingo-blue/5"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}
