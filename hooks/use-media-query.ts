"use client";
import { useSyncExternalStore } from "react";

function subscribe(callback: () => void) {
  const mql = window.matchMedia("(max-width: 767px)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

export function useIsMobile() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia("(max-width: 767px)").matches,
    () => false
  );
}
