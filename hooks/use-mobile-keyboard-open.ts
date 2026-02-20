"use client";

import { useEffect, useState } from "react";
import { useIsMobile } from "./use-media-query";

function isEditableElement(element: Element | null): boolean {
  if (!(element instanceof HTMLElement)) return false;
  const tag = element.tagName;
  return (
    element.isContentEditable ||
    tag === "INPUT" ||
    tag === "TEXTAREA" ||
    tag === "SELECT"
  );
}

export function useMobileKeyboardOpen() {
  const isMobile = useIsMobile();
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => {
    if (!isMobile) {
      setIsKeyboardOpen(false);
      return;
    }

    const viewport = window.visualViewport;
    if (!viewport) {
      const handleFocusIn = () => setIsKeyboardOpen(true);
      const handleFocusOut = () => setIsKeyboardOpen(false);
      window.addEventListener("focusin", handleFocusIn);
      window.addEventListener("focusout", handleFocusOut);
      return () => {
        window.removeEventListener("focusin", handleFocusIn);
        window.removeEventListener("focusout", handleFocusOut);
      };
    }

    let baselineHeight = viewport.height;

    const recompute = () => {
      const activeElement = document.activeElement;
      const hasEditableFocus = isEditableElement(activeElement);
      const heightDelta = baselineHeight - viewport.height;
      // Mobile keyboards usually reduce viewport by >120px.
      setIsKeyboardOpen(hasEditableFocus && heightDelta > 120);
    };

    const handleFocusIn = () => {
      requestAnimationFrame(recompute);
    };

    const handleFocusOut = () => {
      setTimeout(recompute, 60);
    };

    const handleViewportResize = () => {
      if (!isEditableElement(document.activeElement)) {
        baselineHeight = Math.max(baselineHeight, viewport.height);
      }
      recompute();
    };

    const handleOrientationChange = () => {
      baselineHeight = viewport.height;
      recompute();
    };

    viewport.addEventListener("resize", handleViewportResize);
    window.addEventListener("focusin", handleFocusIn);
    window.addEventListener("focusout", handleFocusOut);
    window.addEventListener("orientationchange", handleOrientationChange);

    recompute();

    return () => {
      viewport.removeEventListener("resize", handleViewportResize);
      window.removeEventListener("focusin", handleFocusIn);
      window.removeEventListener("focusout", handleFocusOut);
      window.removeEventListener("orientationchange", handleOrientationChange);
    };
  }, [isMobile]);

  return isKeyboardOpen;
}
