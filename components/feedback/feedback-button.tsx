"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useSession } from "@/lib/auth-client";
import { submitFeedback } from "@/lib/actions/feedback";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Turnstile, type TurnstileRef } from "@/components/auth/turnstile";

type FormState = "idle" | "submitting" | "success" | "error";

export function FeedbackButton() {
  const { data: session } = useSession();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [formState, setFormState] = useState<FormState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const turnstileRef = useRef<TurnstileRef>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  const isLoggedIn = !!session?.user;

  // Close on escape key
  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  // Close on click outside modal
  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    // Delay to avoid the opening click triggering this
    const timer = setTimeout(() => {
      document.addEventListener("mousedown", handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("mousedown", handleClick);
    };
  }, [open]);

  const handleTurnstileVerify = useCallback((token: string) => {
    setTurnstileToken(token);
  }, []);

  const handleTurnstileExpire = useCallback(() => {
    setTurnstileToken(null);
  }, []);

  function resetForm() {
    setMessage("");
    setEmail("");
    setTurnstileToken(null);
    setFormState("idle");
    setErrorMsg("");
    turnstileRef.current?.reset();
  }

  function handleClose() {
    setOpen(false);
    // Reset after close animation
    setTimeout(resetForm, 200);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!message.trim()) return;

    setFormState("submitting");
    setErrorMsg("");

    const result = await submitFeedback({
      message,
      email: isLoggedIn ? undefined : email,
      turnstileToken: isLoggedIn ? undefined : (turnstileToken ?? undefined),
    });

    if (result.success) {
      setFormState("success");
    } else {
      setFormState("error");
      setErrorMsg(result.error || "Something went wrong");
      // Reset turnstile on error for unauthenticated users
      if (!isLoggedIn) {
        setTurnstileToken(null);
        turnstileRef.current?.reset();
      }
    }
  }

  // Determine if submit should be disabled
  const submitDisabled =
    !message.trim() ||
    (!isLoggedIn && !email.trim()) ||
    (!isLoggedIn &&
      turnstileToken === null &&
      !!process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

  return (
    <>
      {/* Floating Action Button */}
      <button
        onClick={() => setOpen(true)}
        aria-label="Send feedback or ask for help"
        className="fixed right-4 bottom-20 md:bottom-6 md:right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-lingo-blue text-white border-b-4 border-lingo-blue-dark hover:bg-lingo-blue/90 active:border-b-0 active:mt-1 shadow-lg transition-all duration-100 cursor-pointer"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      </button>

      {/* Modal Overlay */}
      {open && (
        <div className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40">
          <div
            ref={modalRef}
            className="w-full max-w-md rounded-t-2xl md:rounded-2xl bg-white border-2 border-lingo-border p-6 animate-slide-up max-h-[90vh] overflow-y-auto"
          >
            {formState === "success" ? (
              <div className="text-center py-4">
                <div className="text-4xl mb-3">&#10003;</div>
                <h3 className="text-lg font-bold text-lingo-text mb-2">
                  Thanks for your feedback!
                </h3>
                <p className="text-sm text-lingo-text-light mb-4">
                  We&apos;ll get back to you if needed.
                </p>
                <Button variant="secondary" size="sm" onClick={handleClose}>
                  Close
                </Button>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-bold text-lingo-text">
                    Feedback / Help
                  </h2>
                  <button
                    onClick={handleClose}
                    className="text-lingo-text-light hover:text-lingo-text transition-colors cursor-pointer"
                    aria-label="Close"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="18" y1="6" x2="6" y2="18" />
                      <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  {/* Show email field only for unauthenticated users */}
                  {!isLoggedIn && (
                    <>
                      <Input
                        label="Email"
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                      <Turnstile
                        ref={turnstileRef}
                        onVerify={handleTurnstileVerify}
                        onExpire={handleTurnstileExpire}
                        onError={handleTurnstileExpire}
                      />
                    </>
                  )}

                  {/* Message */}
                  <div className="w-full">
                    <label className="mb-1.5 block text-sm font-bold text-lingo-text-light uppercase tracking-wide">
                      Message
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Tell us what's on your mind — feedback, bugs, questions, feature requests..."
                      required
                      rows={4}
                      className="w-full rounded-xl border-2 border-lingo-border bg-white px-4 py-3 text-base text-lingo-text placeholder:text-lingo-gray-dark focus:border-lingo-blue focus:outline-none transition-colors resize-y min-h-[120px]"
                    />
                  </div>

                  {errorMsg && (
                    <p className="text-sm text-lingo-red font-medium">
                      {errorMsg}
                    </p>
                  )}

                  <Button
                    type="submit"
                    loading={formState === "submitting"}
                    disabled={submitDisabled}
                    className="w-full"
                  >
                    Send
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
