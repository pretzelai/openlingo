"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export const AUTHENTICATED_PREFETCH_ROUTES = [
  "/chat",
  "/units",
  "/units/browse",
  "/read",
  "/words",
  "/settings",
] as const;

const PREFETCH_SESSION_KEY = "openlingo:prefetched-auth-routes:v1";
let hasPrefetchStartedThisTab = false;

export function BackgroundRoutePrefetch() {
  const router = useRouter();

  useEffect(() => {
    if (hasPrefetchStartedThisTab) {
      return;
    }

    try {
      if (window.sessionStorage.getItem(PREFETCH_SESSION_KEY) === "1") {
        hasPrefetchStartedThisTab = true;
        return;
      }
      window.sessionStorage.setItem(PREFETCH_SESSION_KEY, "1");
    } catch {
      // Ignore storage failures and still prefetch once per runtime.
    }

    hasPrefetchStartedThisTab = true;

    const queue = [...AUTHENTICATED_PREFETCH_ROUTES];
    let isCancelled = false;
    let idleHandle: number | null = null;
    let timeoutHandle: number | null = null;

    const runNext = () => {
      idleHandle = null;
      timeoutHandle = null;

      if (isCancelled) {
        return;
      }

      const route = queue.shift();
      if (!route) {
        return;
      }

      router.prefetch(route);
      scheduleNext();
    };

    const scheduleNext = () => {
      if (isCancelled || queue.length === 0) {
        return;
      }

      if (typeof window.requestIdleCallback === "function") {
        idleHandle = window.requestIdleCallback(runNext, { timeout: 1500 });
        return;
      }

      timeoutHandle = window.setTimeout(runNext, 64);
    };

    scheduleNext();

    return () => {
      isCancelled = true;
      if (idleHandle !== null && typeof window.cancelIdleCallback === "function") {
        window.cancelIdleCallback(idleHandle);
      }
      if (timeoutHandle !== null) {
        window.clearTimeout(timeoutHandle);
      }
    };
  }, [router]);

  return null;
}
