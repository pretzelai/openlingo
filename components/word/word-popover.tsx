"use client";

import { useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useIsMobile } from "@/hooks/use-media-query";
import { WordTooltip } from "./word-tooltip";

interface WordPopoverProps {
  word: string;
  language: string;
  anchorRect: DOMRect;
  onClose: () => void;
}

function computePosition(el: HTMLElement, anchorRect: DOMRect) {
  const rect = el.getBoundingClientRect();
  const POPOVER_WIDTH = 280;
  const GAP = 8;

  // Horizontal: center on anchor, clamp to viewport
  let left = anchorRect.left + anchorRect.width / 2 - POPOVER_WIDTH / 2;
  left = Math.max(8, Math.min(left, window.innerWidth - POPOVER_WIDTH - 8));

  // Vertical: prefer above, fall back to below
  let top: number;
  if (anchorRect.top - rect.height - GAP > 0) {
    top = anchorRect.top - rect.height - GAP + window.scrollY;
  } else {
    top = anchorRect.bottom + GAP + window.scrollY;
  }

  el.style.top = `${top}px`;
  el.style.left = `${left}px`;
  el.style.opacity = "1";
}

export function WordPopover({ word, language, anchorRect, onClose }: WordPopoverProps) {
  const isMobile = useIsMobile();
  const popoverRef = useRef<HTMLDivElement>(null);

  // Position the popover after it renders (desktop only)
  const positionRef = useCallback(
    (node: HTMLDivElement | null) => {
      if (!node || isMobile) return;
      popoverRef.current = node;
      // Use requestAnimationFrame to measure after paint
      requestAnimationFrame(() => computePosition(node, anchorRect));
    },
    [anchorRect, isMobile]
  );

  // Click outside to close (desktop)
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  // Escape to close
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Mobile: bottom sheet
  if (isMobile) {
    return createPortal(
      <div className="fixed inset-0 z-50">
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/30" onClick={onClose} />
        {/* Sheet */}
        <div
          ref={popoverRef}
          className="absolute bottom-0 left-0 right-0 max-h-[60vh] overflow-y-auto rounded-t-2xl bg-lingo-card shadow-xl animate-slide-up"
        >
          {/* Drag handle */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="h-1 w-10 rounded-full bg-lingo-gray" />
          </div>
          <WordTooltip word={word} language={language} onClose={onClose} />
        </div>
      </div>,
      document.body
    );
  }

  // Desktop: positioned popover
  return createPortal(
    <div
      ref={positionRef}
      style={{
        position: "absolute",
        top: -9999,
        left: -9999,
        width: 280,
        opacity: 0,
      }}
      className="z-50 rounded-2xl border border-lingo-border bg-lingo-card shadow-lg transition-opacity duration-100"
    >
      <WordTooltip word={word} language={language} onClose={onClose} />
    </div>,
    document.body
  );
}
