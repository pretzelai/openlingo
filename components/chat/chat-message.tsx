"use client";

import type { UIMessage } from "@ai-sdk/react";
import { ChatExercise } from "./chat-exercise";
import { ToolCall } from "./tool-call";
import ReactMarkdown from "react-markdown";

interface ChatMessageProps {
  message: UIMessage;
  language: string;
  isLoading: boolean;
  completedExercises: Record<string, { correct: boolean; answer: string }>;
  onExerciseComplete: (
    toolCallId: string,
    correct: boolean,
    userAnswer: string
  ) => void;
}

export function ChatMessage({
  message,
  language,
  isLoading,
  completedExercises,
  onExerciseComplete,
}: ChatMessageProps) {
  const isUser = message.role === "user";

  // Skip auto-generated exercise result messages
  const firstText = message.parts.find((p) => p.type === "text");
  if (
    isUser &&
    firstText?.type === "text" &&
    firstText.text.startsWith("Exercise result:")
  ) {
    return null;
  }

  return (
    <div
      className="group/message w-full animate-in fade-in duration-200"
      data-role={message.role}
    >
      <div
        className={`flex w-full items-start gap-2 md:gap-3 ${
          isUser ? "justify-end" : "justify-start"
        }`}
      >
        {/* Assistant avatar */}
        {!isUser && (
          <div className="-mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-lingo-green/10 ring-1 ring-lingo-green/20">
            <span className="text-sm">🤖</span>
          </div>
        )}

        {/* Message content */}
        <div
          className={`flex flex-col ${
            isUser
              ? "max-w-[calc(100%-2.5rem)] sm:max-w-[min(fit-content,80%)] items-end"
              : "w-full gap-2 md:gap-3"
          }`}
        >
          {message.parts.map((part, index) => {
            const key = `msg-${message.id}-part-${index}`;

            // Text parts
            if (part.type === "text" && part.text.trim()) {
              if (isUser) {
                return (
                  <div
                    key={key}
                    className="w-fit whitespace-pre-wrap break-words rounded-2xl bg-lingo-blue px-3 py-2 text-sm text-white"
                  >
                    {part.text}
                  </div>
                );
              }

              return (
                <div
                  key={key}
                  className="prose prose-sm max-w-none text-lingo-text [&_p]:my-1 [&_ul]:my-1.5 [&_ol]:my-1.5 [&_li]:my-0 [&_code]:whitespace-pre-wrap [&_code]:break-words [&_pre]:max-w-full [&_pre]:overflow-x-auto [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                >
                  <ReactMarkdown>{part.text}</ReactMarkdown>
                </div>
              );
            }

            // Tool parts (type is "tool-<toolName>")
            if (part.type.startsWith("tool-")) {
              const toolPart = part as {
                type: string;
                toolCallId: string;
                state: string;
                input?: Record<string, unknown>;
                output?: unknown;
              };
              const toolName = toolPart.type.slice(5);

              // Exercise tool: render inline interactive exercise
              if (toolName === "presentExercise" && toolPart.input?.exercise) {
                const completed = completedExercises[toolPart.toolCallId];
                return (
                  <ChatExercise
                    key={toolPart.toolCallId}
                    exercise={
                      toolPart.input
                        .exercise as import("@/lib/content/types").Exercise
                    }
                    toolCallId={toolPart.toolCallId}
                    language={language}
                    completed={completed}
                    onComplete={onExerciseComplete}
                  />
                );
              }

              // Other tools: collapsible tool call display
              return (
                <ToolCall
                  key={key}
                  toolName={toolName}
                  state={toolPart.state}
                  input={toolPart.input}
                  output={toolPart.output}
                />
              );
            }

            return null;
          })}
        </div>
      </div>
    </div>
  );
}
