"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { ReadingModeText } from "./reading-mode-text";
import { findWordAtTime, type WordTimestamp } from "@/lib/audio/align-timestamps";

interface ReadingModeProps {
  audioUrl: string;
  timestamps: WordTimestamp[];
  language: string;
  onClose: () => void;
  initialWordIndex?: number;
}

const PLAYBACK_SPEEDS = [0.75, 1, 1.25];

function isSentenceEnd(word: string): boolean {
  return word.endsWith(".") || word.endsWith("!") || word.endsWith("?");
}

function findSentenceStart(
  timestamps: WordTimestamp[],
  wordIndex: number,
): number {
  let idx = wordIndex;
  while (idx > 0 && !isSentenceEnd(timestamps[idx - 1]?.word || "")) {
    idx--;
  }
  return idx;
}

export function ReadingMode({
  audioUrl,
  timestamps,
  language,
  onClose,
  initialWordIndex = 0,
}: ReadingModeProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [hasInitialized, setHasInitialized] = useState(false);

  const startingWordIndex = findSentenceStart(timestamps, initialWordIndex);
  const [currentWordIndex, setCurrentWordIndex] = useState(startingWordIndex);
  const [wasPlayingBeforeTap, setWasPlayingBeforeTap] = useState(false);

  // Update current word based on audio time
  useEffect(() => {
    if (timestamps.length > 0) {
      const wordIndex = findWordAtTime(timestamps, currentTime);
      setCurrentWordIndex(wordIndex);
    }
  }, [currentTime, timestamps]);

  // Audio event handlers
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => setIsPlaying(false);
    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleEnded);
    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleEnded);
    };
  }, []);

  // Set initial audio position
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || hasInitialized) return;
    const initializePosition = () => {
      if (startingWordIndex > 0 && timestamps[startingWordIndex]) {
        audio.currentTime = timestamps[startingWordIndex].start;
        setCurrentTime(timestamps[startingWordIndex].start);
      }
      setHasInitialized(true);
    };
    if (audio.readyState >= 1) {
      initializePosition();
    } else {
      audio.addEventListener("loadedmetadata", initializePosition, {
        once: true,
      });
      return () =>
        audio.removeEventListener("loadedmetadata", initializePosition);
    }
  }, [startingWordIndex, timestamps, hasInitialized]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
    } else {
      audio.play();
      setIsPlaying(true);
    }
  }, [isPlaying]);

  const goToWord = useCallback(
    (index: number) => {
      const audio = audioRef.current;
      if (!audio || !timestamps[index]) return;
      audio.currentTime = timestamps[index].start;
      setCurrentTime(timestamps[index].start);
      setCurrentWordIndex(index);
    },
    [timestamps],
  );

  const goToPreviousWord = useCallback(() => {
    if (currentWordIndex > 0) goToWord(currentWordIndex - 1);
  }, [currentWordIndex, goToWord]);

  const goToNextWord = useCallback(() => {
    if (currentWordIndex < timestamps.length - 1)
      goToWord(currentWordIndex + 1);
  }, [currentWordIndex, timestamps.length, goToWord]);

  const goToPreviousSentence = useCallback(() => {
    let idx = currentWordIndex;
    if (idx > 0 && isSentenceEnd(timestamps[idx - 1]?.word || "")) idx--;
    while (idx > 0 && !isSentenceEnd(timestamps[idx - 1]?.word || "")) idx--;
    if (idx > 0) {
      idx--;
      while (idx > 0 && !isSentenceEnd(timestamps[idx - 1]?.word || ""))
        idx--;
    }
    goToWord(idx);
  }, [currentWordIndex, timestamps, goToWord]);

  const goToNextSentence = useCallback(() => {
    let idx = currentWordIndex;
    while (
      idx < timestamps.length - 1 &&
      !isSentenceEnd(timestamps[idx]?.word || "")
    )
      idx++;
    if (idx < timestamps.length - 1) idx++;
    goToWord(idx);
  }, [currentWordIndex, timestamps, goToWord]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      )
        return;
      switch (e.key) {
        case " ":
          e.preventDefault();
          togglePlay();
          break;
        case "ArrowLeft":
          e.preventDefault();
          if (e.shiftKey) goToPreviousSentence();
          else goToPreviousWord();
          break;
        case "ArrowRight":
          e.preventDefault();
          if (e.shiftKey) goToNextSentence();
          else goToNextWord();
          break;
        case "Escape":
          e.preventDefault();
          onClose();
          break;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    togglePlay,
    goToPreviousWord,
    goToNextWord,
    goToPreviousSentence,
    goToNextSentence,
    onClose,
  ]);

  const handleSeek = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const audio = audioRef.current;
      if (!audio) return;
      const time = parseFloat(e.target.value);
      audio.currentTime = time;
      setCurrentTime(time);
    },
    [],
  );

  const cycleSpeed = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
    const newSpeed = PLAYBACK_SPEEDS[nextIndex];
    audio.playbackRate = newSpeed;
    setPlaybackSpeed(newSpeed);
  }, [playbackSpeed]);

  const handleWordClick = useCallback(
    (index: number) => {
      const audio = audioRef.current;
      if (!audio || !timestamps[index]) return;
      setWasPlayingBeforeTap(isPlaying);
      goToWord(index);
      audio.pause();
      setIsPlaying(false);
    },
    [timestamps, goToWord, isPlaying],
  );

  const handleTooltipClose = useCallback(() => {
    if (wasPlayingBeforeTap) {
      const audio = audioRef.current;
      if (audio) {
        audio.play();
        setIsPlaying(true);
      }
    }
    setWasPlayingBeforeTap(false);
  }, [wasPlayingBeforeTap]);

  const formatTime = (time: number) => {
    if (!isFinite(time) || isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed inset-0 z-50 bg-lingo-bg flex flex-col">
      <audio ref={audioRef} src={audioUrl} preload="auto" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b-2 border-lingo-border">
        <button
          onClick={onClose}
          className="p-2 -ml-2 text-lingo-text-light hover:text-lingo-text transition-colors rounded-lg hover:bg-lingo-gray/50"
          title="Close (Esc)"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
        <h2 className="text-lingo-text text-sm font-bold">Reading Mode</h2>
        <button
          onClick={cycleSpeed}
          className={`px-2.5 py-1 text-xs font-bold rounded-full border-2 transition-all ${
            playbackSpeed !== 1
              ? "bg-lingo-blue/10 border-lingo-blue/30 text-lingo-blue"
              : "bg-lingo-gray/50 border-lingo-border text-lingo-text-light hover:border-lingo-text-light/30"
          }`}
          title="Playback speed"
        >
          {playbackSpeed}x
        </button>
      </div>

      {/* Word display */}
      <ReadingModeText
        timestamps={timestamps}
        currentWordIndex={currentWordIndex}
        onWordClick={handleWordClick}
        onTooltipClose={handleTooltipClose}
        language={language}
        isPlaying={isPlaying}
      />

      {/* Controls */}
      <div className="bg-white border-t-2 border-lingo-border px-4 pt-4 pb-6">
        {/* Progress bar */}
        <div className="flex items-center gap-3 mb-5">
          <span className="text-xs text-lingo-text-light w-10 font-mono tabular-nums">
            {formatTime(currentTime)}
          </span>
          <div className="flex-1 relative h-1.5 bg-lingo-gray rounded-full overflow-hidden">
            <div
              className="absolute inset-y-0 left-0 bg-lingo-blue rounded-full transition-all duration-100"
              style={{ width: `${progress}%` }}
            />
            <input
              type="range"
              min={0}
              max={duration || 100}
              value={currentTime}
              onChange={handleSeek}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
          </div>
          <span className="text-xs text-lingo-text-light w-10 font-mono tabular-nums text-right">
            {formatTime(duration)}
          </span>
        </div>

        {/* Playback controls */}
        <div className="flex items-center justify-center">
          <div className="flex items-center gap-1">
            {/* Previous sentence */}
            <div className="flex flex-col items-center">
              <button
                onClick={goToPreviousSentence}
                disabled={currentWordIndex === 0}
                className={`p-2.5 rounded-full transition-all ${
                  currentWordIndex === 0
                    ? "text-lingo-gray cursor-not-allowed"
                    : "text-lingo-text-light hover:text-lingo-text hover:bg-lingo-gray/50"
                }`}
                title="Previous sentence (Shift + ←)"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M11 19l-7-7 7-7m8 14l-7-7 7-7"
                  />
                </svg>
              </button>
              <span className="text-[10px] text-lingo-text-light mt-0.5">
                sentence
              </span>
            </div>

            {/* Previous word */}
            <div className="flex flex-col items-center">
              <button
                onClick={goToPreviousWord}
                disabled={currentWordIndex === 0}
                className={`p-2.5 rounded-full transition-all ${
                  currentWordIndex === 0
                    ? "text-lingo-gray cursor-not-allowed"
                    : "text-lingo-text-light hover:text-lingo-text hover:bg-lingo-gray/50"
                }`}
                title="Previous word (←)"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
              </button>
              <span className="text-[10px] text-lingo-text-light mt-0.5">
                word
              </span>
            </div>

            {/* Play/Pause */}
            <div className="flex flex-col items-center mx-3">
              <button
                onClick={togglePlay}
                className="h-14 w-14 rounded-full bg-lingo-green text-white shadow-[0_4px_0_0] shadow-lingo-green-dark active:translate-y-[2px] active:shadow-[0_2px_0_0] active:shadow-lingo-green-dark transition-all flex items-center justify-center"
                title={isPlaying ? "Pause (Space)" : "Play (Space)"}
              >
                {isPlaying ? (
                  <svg
                    className="h-6 w-6"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
                  </svg>
                ) : (
                  <svg
                    className="h-6 w-6 ml-0.5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M8 5v14l11-7z" />
                  </svg>
                )}
              </button>
              <span className="text-[10px] text-transparent mt-0.5 select-none">
                play
              </span>
            </div>

            {/* Next word */}
            <div className="flex flex-col items-center">
              <button
                onClick={goToNextWord}
                disabled={currentWordIndex === timestamps.length - 1}
                className={`p-2.5 rounded-full transition-all ${
                  currentWordIndex === timestamps.length - 1
                    ? "text-lingo-gray cursor-not-allowed"
                    : "text-lingo-text-light hover:text-lingo-text hover:bg-lingo-gray/50"
                }`}
                title="Next word (→)"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </button>
              <span className="text-[10px] text-lingo-text-light mt-0.5">
                word
              </span>
            </div>

            {/* Next sentence */}
            <div className="flex flex-col items-center">
              <button
                onClick={goToNextSentence}
                disabled={currentWordIndex === timestamps.length - 1}
                className={`p-2.5 rounded-full transition-all ${
                  currentWordIndex === timestamps.length - 1
                    ? "text-lingo-gray cursor-not-allowed"
                    : "text-lingo-text-light hover:text-lingo-text hover:bg-lingo-gray/50"
                }`}
                title="Next sentence (Shift + →)"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M13 5l7 7-7 7m-8-14l7 7-7 7"
                  />
                </svg>
              </button>
              <span className="text-[10px] text-lingo-text-light mt-0.5">
                sentence
              </span>
            </div>
          </div>
        </div>

        {/* Keyboard hints (desktop) */}
        <div className="hidden sm:flex justify-center gap-6 mt-4 text-lingo-text-light text-xs">
          <span>
            <kbd className="px-1.5 py-0.5 bg-lingo-gray/50 rounded border border-lingo-border text-lingo-text-light">
              Space
            </kbd>{" "}
            Play/Pause
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-lingo-gray/50 rounded border border-lingo-border text-lingo-text-light">
              ←
            </kbd>{" "}
            <kbd className="px-1.5 py-0.5 bg-lingo-gray/50 rounded border border-lingo-border text-lingo-text-light">
              →
            </kbd>{" "}
            Word
          </span>
          <span>
            <kbd className="px-1.5 py-0.5 bg-lingo-gray/50 rounded border border-lingo-border text-lingo-text-light">
              Shift
            </kbd>
            +Arrows Sentence
          </span>
        </div>

        {/* Mobile hint */}
        <p className="sm:hidden text-center text-lingo-text-light text-xs mt-4">
          Tap any word to pause and see its meaning
        </p>
      </div>
    </div>
  );
}
