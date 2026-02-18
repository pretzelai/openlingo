"use client";

import { useState, useRef, useEffect } from "react";

interface AudioPlayerProps {
  audioUrl: string;
  onClose?: () => void;
  hasTimestamps?: boolean;
  onReadingModeClick?: () => void;
  onTimeUpdate?: (time: number) => void;
  onPlayingChange?: (playing: boolean) => void;
}

const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5];

export function AudioPlayer({
  audioUrl,
  onClose,
  hasTimestamps,
  onReadingModeClick,
  onTimeUpdate,
  onPlayingChange,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const updateTime = () => {
      setCurrentTime(audio.currentTime);
      onTimeUpdate?.(audio.currentTime);
    };
    const updateDuration = () => setDuration(audio.duration);
    const handleEnded = () => {
      setIsPlaying(false);
      onPlayingChange?.(false);
    };
    audio.addEventListener("timeupdate", updateTime);
    audio.addEventListener("loadedmetadata", updateDuration);
    audio.addEventListener("ended", handleEnded);
    return () => {
      audio.removeEventListener("timeupdate", updateTime);
      audio.removeEventListener("loadedmetadata", updateDuration);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [onTimeUpdate, onPlayingChange]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isPlaying) audio.pause();
    else audio.play();
    setIsPlaying(!isPlaying);
    onPlayingChange?.(!isPlaying);
  };

  const seek = (seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(
      0,
      Math.min(audio.currentTime + seconds, duration),
    );
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const audio = audioRef.current;
    if (!audio) return;
    const time = parseFloat(e.target.value);
    audio.currentTime = time;
    setCurrentTime(time);
  };

  const cycleSpeed = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
    const newSpeed = PLAYBACK_SPEEDS[nextIndex];
    audio.playbackRate = newSpeed;
    setPlaybackSpeed(newSpeed);
  };

  const formatTime = (time: number) => {
    if (!isFinite(time) || isNaN(time)) return "0:00";
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="bg-white border-t md:border-2 border-lingo-border md:rounded-2xl shadow-lg">
      <audio ref={audioRef} src={audioUrl} preload="metadata" />

      {/* Progress bar */}
      <div className="flex items-center gap-3 px-4 pt-3 pb-2">
        <span className="text-xs text-lingo-text-light w-10 font-mono tabular-nums">
          {formatTime(currentTime)}
        </span>
        <div className="flex-1 relative h-1.5 bg-lingo-gray rounded-full overflow-hidden">
          <div
            className="absolute inset-y-0 left-0 bg-lingo-blue rounded-full transition-all duration-150"
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

      {/* Controls */}
      <div className="flex items-center justify-between px-4 pt-1 pb-4">
        {/* Left: Reading Mode */}
        <div className="flex items-center gap-2">
          {hasTimestamps && onReadingModeClick ? (
            <button
              onClick={onReadingModeClick}
              className="p-2 text-lingo-text-light hover:text-lingo-blue transition-colors"
              title="Reading Mode"
            >
              {/* BookOpenText icon */}
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
                  d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                />
              </svg>
            </button>
          ) : (
            <div className="w-9" />
          )}
        </div>

        {/* Center: Playback */}
        <div className="flex items-center gap-1">
          {/* Skip back 10s */}
          <button
            onClick={() => seek(-10)}
            className="flex flex-col items-center p-1.5 text-lingo-text-light hover:text-lingo-text hover:bg-lingo-gray/50 rounded-lg transition-colors"
            title="Skip back 10 seconds"
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
                d="M2.5 2v6h6M2.66 8A9 9 0 1 1 3 12"
              />
            </svg>
            <span className="text-[10px] font-medium leading-tight">10s</span>
          </button>

          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="h-12 w-12 rounded-full bg-lingo-green text-white shadow-[0_4px_0_0] shadow-lingo-green-dark active:translate-y-[2px] active:shadow-[0_2px_0_0] active:shadow-lingo-green-dark transition-all flex items-center justify-center mx-2"
          >
            {isPlaying ? (
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg
                className="h-5 w-5 ml-0.5"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {/* Skip forward 10s */}
          <button
            onClick={() => seek(10)}
            className="flex flex-col items-center p-1.5 text-lingo-text-light hover:text-lingo-text hover:bg-lingo-gray/50 rounded-lg transition-colors"
            title="Skip forward 10 seconds"
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
                d="M21.5 2v6h-6M21.34 8A9 9 0 1 0 21 12"
              />
            </svg>
            <span className="text-[10px] font-medium leading-tight">10s</span>
          </button>
        </div>

        {/* Right: Speed + Close */}
        <div className="flex items-center gap-2">
          <button
            onClick={cycleSpeed}
            className={`px-2.5 py-1 text-xs font-medium rounded-lg border-2 transition-all duration-200 ${
              playbackSpeed !== 1
                ? "bg-lingo-blue/10 border-lingo-blue/30 text-lingo-blue"
                : "bg-lingo-gray/50 border-lingo-border text-lingo-text-light hover:border-lingo-text-light/30"
            }`}
          >
            {playbackSpeed}x
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-2 text-lingo-text-light hover:text-lingo-text transition-colors"
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
          )}
        </div>
      </div>
    </div>
  );
}
