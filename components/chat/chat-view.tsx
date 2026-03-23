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

import type { Exercise } from "@/lib/content/types";
import { useIsMobile } from "@/hooks/use-media-query";
import { useMobileKeyboardOpen } from "@/hooks/use-mobile-keyboard-open";
import { useAudio } from "@/hooks/use-audio";

interface ChatViewProps {
  language?: string;
  preferredModel: string;
  conversationId?: string;
  initialMessages?: UIMessage[];
  initialPrompt?: string;
}

type VoiceCaptureState = "idle" | "requesting" | "recording" | "transcribing";

export function ChatView({
  language,
  preferredModel,
  conversationId,
  initialMessages,
  initialPrompt,
}: ChatViewProps) {
  const effectiveLanguage = language ?? "en";
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const shouldHoldToTalkRef = useRef(false);
  const shouldTranscribeRef = useRef(false);
  const voiceModeRef = useRef(false);
  const [input, setInput] = useState("");
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceState, setVoiceState] = useState<VoiceCaptureState>("idle");
  const [voiceError, setVoiceError] = useState<string | null>(null);
  const [lastTranscript, setLastTranscript] = useState<string | null>(null);
  const isMobile = useIsMobile();
  const isKeyboardOpen = useMobileKeyboardOpen();
  const {
    play: playAssistantAudio,
    stop: stopAssistantAudio,
    loading: assistantAudioLoading,
  } = useAudio();
  const [completedExercises, setCompletedExercises] = useState<
    Record<string, { correct: boolean; answer: string }>
  >({});
  const [initialMessageIds] = useState(
    () => new Set((initialMessages ?? []).map((m) => m.id)),
  );
  const [chatId] = useState(() => conversationId ?? crypto.randomUUID());
  const convIdRef = useRef<string | null>(conversationId ?? null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        body: {
          language: effectiveLanguage,
          model: preferredModel,
          interactionMode: voiceMode ? "voice" : "text",
        },
      }),
    [effectiveLanguage, preferredModel, voiceMode],
  );

  const cleanupRecorderResources = useCallback(() => {
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const stopVoiceRecording = useCallback(
    (cancel = false) => {
      shouldHoldToTalkRef.current = false;
      shouldTranscribeRef.current = !cancel;

      const recorder = mediaRecorderRef.current;
      if (recorder?.state === "recording") {
        recorder.stop();
        return;
      }

      if (cancel) {
        cleanupRecorderResources();
      }

      setVoiceState("idle");
    },
    [cleanupRecorderResources],
  );

  const playVoiceReply = useCallback(
    (message: UIMessage | undefined) => {
      if (!voiceModeRef.current || !message || message.role !== "assistant") return;

      const text = getSpeakableMessageText(message);
      if (!text) return;

      void playAssistantAudio(text, effectiveLanguage).catch(() => {});
    },
    [effectiveLanguage, playAssistantAudio],
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
        const newId = await createConversation(
          effectiveLanguage,
          title,
          allMessages,
        );
        convIdRef.current = newId;
        router.replace(`/chat/${newId}`);
      }

      const lastAssistantMessage = [...allMessages]
        .reverse()
        .find((message) => message.role === "assistant");
      playVoiceReply(lastAssistantMessage);
    },
  });

  const isLoading = status === "streaming" || status === "submitted";

  const submitMessage = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isLoading) {
        return false;
      }

      stopAssistantAudio();
      sendMessage({ text: trimmed });
      return true;
    },
    [isLoading, sendMessage, stopAssistantAudio],
  );

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

  useEffect(() => {
    voiceModeRef.current = voiceMode;
    if (!voiceMode) {
      stopAssistantAudio();
      stopVoiceRecording(true);
    }
  }, [voiceMode, stopAssistantAudio, stopVoiceRecording]);

  useEffect(() => {
    return () => {
      shouldHoldToTalkRef.current = false;
      shouldTranscribeRef.current = false;
      stopAssistantAudio();
      cleanupRecorderResources();
    };
  }, [cleanupRecorderResources, stopAssistantAudio]);

  function submitForm() {
    if (!submitMessage(input)) return;
    setInput("");
  }

  const startVoiceRecording = useCallback(async () => {
    if (isLoading || voiceState === "transcribing") return;
    if (
      typeof window === "undefined" ||
      !navigator.mediaDevices?.getUserMedia ||
      typeof MediaRecorder === "undefined"
    ) {
      setVoiceError("Voice recording is not supported in this browser.");
      return;
    }

    shouldHoldToTalkRef.current = true;
    shouldTranscribeRef.current = true;
    setVoiceError(null);
    setLastTranscript(null);
    stopAssistantAudio();
    setVoiceState("requesting");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

      if (!shouldHoldToTalkRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        setVoiceState("idle");
        return;
      }

      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });

      mediaStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const shouldTranscribe = shouldTranscribeRef.current;
        const blob = new Blob(audioChunksRef.current, { type: mimeType });
        cleanupRecorderResources();

        if (!shouldTranscribe) {
          setVoiceState("idle");
          return;
        }

        if (blob.size === 0) {
          setVoiceError("I couldn't hear anything. Please try again.");
          setVoiceState("idle");
          return;
        }

        setVoiceState("transcribing");

        try {
          const formData = new FormData();
          formData.append("audio", blob, "voice-message.webm");
          formData.append("language", effectiveLanguage);

          const res = await fetch("/api/stt", {
            method: "POST",
            body: formData,
          });

          if (!res.ok) {
            throw new Error("Transcription failed");
          }

          const data = (await res.json()) as { text?: string };
          const transcribedText = data.text?.trim() ?? "";

          if (!transcribedText) {
            setVoiceError("I couldn't understand that. Please try again.");
            setVoiceState("idle");
            return;
          }

          setLastTranscript(transcribedText);

          if (!submitMessage(transcribedText)) {
            setInput(transcribedText);
          }

          setVoiceState("idle");
        } catch {
          setVoiceError("Could not transcribe audio. Please try again.");
          setVoiceState("idle");
        }
      };

      recorder.start();
      setVoiceState("recording");
    } catch {
      setVoiceError(
        "Microphone access denied. Please allow microphone access and try again.",
      );
      setVoiceState("idle");
    }
  }, [
    cleanupRecorderResources,
    effectiveLanguage,
    isLoading,
    stopAssistantAudio,
    submitMessage,
    voiceState,
  ]);

  const handleVoicePointerDown = useCallback(
    (event: React.PointerEvent<HTMLButtonElement>) => {
      if (event.button !== 0) return;
      event.preventDefault();
      event.currentTarget.setPointerCapture(event.pointerId);
      void startVoiceRecording();
    },
    [startVoiceRecording],
  );

  const handleVoicePointerUp = useCallback(
    (event?: React.PointerEvent<HTMLButtonElement>) => {
      event?.preventDefault();
      stopVoiceRecording();
    },
    [stopVoiceRecording],
  );

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

  const isRecording = voiceState === "recording";
  const isTranscribing = voiceState === "transcribing";
  const isRequestingMic = voiceState === "requesting";

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
                voiceMode={voiceMode}
                onSend={(text) => {
                  submitMessage(text);
                }}
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
        <div className={`mb-1.5 justify-end ${isKeyboardOpen ? "hidden" : "flex"}`}>
          <button
            type="button"
            aria-pressed={voiceMode}
            onClick={() => setVoiceMode((current) => !current)}
            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
              voiceMode
                ? "border-lingo-blue bg-lingo-blue text-white"
                : "border-lingo-border bg-white text-lingo-text-light hover:border-lingo-blue hover:text-lingo-blue"
            }`}
          >
            <MicIcon className="h-3.5 w-3.5" />
            <span>{voiceMode ? "Voice mode on" : "Voice mode"}</span>
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitForm();
          }}
          className="rounded-xl border-2 border-lingo-border bg-white p-2 shadow-sm transition-all duration-200 focus-within:border-lingo-blue hover:border-lingo-text-light/30"
        >
          <div className="flex flex-col gap-2">
            {voiceMode && (
              <div className="rounded-2xl bg-lingo-blue/5 p-3">
                <button
                  type="button"
                  disabled={isLoading || isTranscribing}
                  onPointerDown={handleVoicePointerDown}
                  onPointerUp={handleVoicePointerUp}
                  onPointerCancel={handleVoicePointerUp}
                  onLostPointerCapture={handleVoicePointerUp}
                  className={`flex min-h-24 w-full items-center justify-center gap-3 rounded-2xl border-2 px-5 py-5 text-left transition-all ${
                    isRecording
                      ? "border-lingo-red bg-lingo-red text-white shadow-lg shadow-lingo-red/20"
                      : "border-lingo-blue bg-white text-lingo-blue hover:bg-lingo-blue/5 disabled:border-lingo-border disabled:bg-lingo-gray disabled:text-lingo-text-light"
                  }`}
                >
                  <div
                    className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${
                      isRecording ? "bg-white/15" : "bg-lingo-blue/10"
                    }`}
                  >
                    <MicIcon className="h-7 w-7" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">
                      {isRecording
                        ? "Recording... release to send"
                        : isRequestingMic
                          ? "Waiting for microphone access..."
                          : isTranscribing
                            ? "Transcribing your voice..."
                            : "Hold to talk"}
                    </p>
                    <p
                      className={`mt-1 text-xs ${
                        isRecording ? "text-white/80" : "text-lingo-text-light"
                      }`}
                    >
                      Press and hold the microphone, then release to send.
                    </p>
                  </div>
                </button>

                {(lastTranscript || voiceError || assistantAudioLoading) && (
                  <div className="mt-3 space-y-1 text-sm">
                    {lastTranscript && (
                      <p className="text-lingo-text-light">
                        <span className="font-medium text-lingo-text">You said:</span>{" "}
                        {lastTranscript}
                      </p>
                    )}
                    {assistantAudioLoading && !isLoading && (
                      <p className="text-lingo-text-light">
                        Preparing spoken reply...
                      </p>
                    )}
                    {voiceError && (
                      <p className="text-lingo-red">{voiceError}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-end gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={voiceMode ? "Or type a message..." : "Send a message..."}
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
            </div>
          </div>
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
  voiceMode,
  onSend,
}: {
  language: string;
  voiceMode: boolean;
  onSend: (text: string) => void;
}) {
  const flag = LANG_FLAGS[language] ?? "\u{1F30D}";
  const name = LANG_NAMES[language] ?? language;
  const starters = voiceMode
    ? [
        {
          label: "Let's talk",
          prompt: `Let's have a short conversation in ${name}.`,
        },
        {
          label: "Correct me gently",
          prompt: `Let's practice speaking ${name}. Please gently correct my mistakes.`,
        },
        {
          label: "Teach me a phrase",
          prompt: `Teach me a useful everyday phrase in ${name}.`,
        },
        {
          label: "Explain a word",
          prompt: `Explain an interesting ${name} word I should know today.`,
        },
      ]
    : [
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
      ];

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center px-4">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-lingo-green/10 ring-1 ring-lingo-green/20 mb-4">
        <span className="text-2xl">{flag}</span>
      </div>
      <h2 className="text-lg font-bold text-lingo-text mb-2">AI Tutor</h2>
      <p className="text-sm text-lingo-text-light max-w-sm leading-relaxed">
        {voiceMode
          ? `Hold the voice button and speak naturally. I'll reply in ${name} and read my response aloud.`
          : `Practice vocabulary, review due words, or create custom lessons. Your current language is ${name}.`}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {starters.map(({ label, prompt }) => (
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

function MicIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24">
      <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
    </svg>
  );
}

function getSpeakableMessageText(message: UIMessage): string {
  return message.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join(" ")
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/[`*_>#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
