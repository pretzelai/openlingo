interface ProgressBarProps {
  value: number; // 0-100
  color?: string;
  className?: string;
  showLabel?: boolean;
}

export function ProgressBar({
  value,
  color = "bg-lingo-green",
  className = "",
  showLabel = false,
}: ProgressBarProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div className={`relative ${className}`}>
      <div className="h-4 w-full rounded-full bg-lingo-gray overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ease-out ${color}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      {showLabel && (
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold text-white drop-shadow">
          {Math.round(clamped)}%
        </span>
      )}
    </div>
  );
}
