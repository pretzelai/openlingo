"use client";

import { useEffect, useRef, useState } from "react";

interface VoiceWaveformProps {
  level: number;
  active: boolean;
  className?: string;
}

const BAR_COUNT = 17;
const VISUAL_NOISE_FLOOR = 0.18;
const BASELINE_HEIGHT = 4;
const MAX_EXTRA_HEIGHT = 20;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function VoiceWaveform({ level, active, className = "" }: VoiceWaveformProps) {
  const levelRef = useRef(level);
  const rafRef = useRef<number | null>(null);
  const [frame, setFrame] = useState({ phase: 0, energy: 0 });

  useEffect(() => {
    levelRef.current = level;
  }, [level]);

  useEffect(() => {
    if (!active) {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      return;
    }

    let phase = 0;
    let energy = 0;
    let lastFrameAt = 0;

    const tick = (now: number) => {
      const last = lastFrameAt || now;
      const elapsed = now - last;

      if (elapsed >= 33) {
        lastFrameAt = now;

        const normalized = clamp(
          (levelRef.current - VISUAL_NOISE_FLOOR) / (1 - VISUAL_NOISE_FLOOR),
          0,
          1,
        );

        const smoothing = normalized > energy ? 0.42 : 0.18;
        const next = energy + (normalized - energy) * smoothing;

        energy = next < 0.015 ? 0 : next;
        phase += elapsed * (0.005 + energy * 0.013);
        setFrame({ phase, energy });
      }

      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [active]);

  const phase = active ? frame.phase : 0;
  const energy = active ? frame.energy : 0;

  return (
    <div
      aria-hidden="true"
      className={`flex h-8 w-24 items-center justify-center rounded-full border border-lingo-border bg-lingo-bg/60 px-1.5 ${className}`}
    >
      <div className="flex h-full w-full items-center justify-between gap-[2px]">
        {Array.from({ length: BAR_COUNT }, (_, index) => {
          const position = index / (BAR_COUNT - 1);
          const centerEnvelope = 0.45 + 0.55 * Math.sin(position * Math.PI);
          const waveA = Math.sin(phase + index * 0.58);
          const waveB = Math.sin(phase * 0.73 - index * 0.42);
          const oscillation = (waveA * 0.62 + waveB * 0.38 + 1) / 2;
          const extra = energy * centerEnvelope * oscillation * MAX_EXTRA_HEIGHT;
          const height = Math.round(BASELINE_HEIGHT + extra);

          return (
            <div
              key={index}
              className="w-[3px] rounded-full bg-lingo-blue/90"
              style={{
                height: `${height}px`,
                opacity: 0.35 + centerEnvelope * 0.6,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}
