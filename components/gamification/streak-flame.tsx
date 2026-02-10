interface StreakFlameProps {
  streak: number;
}

export function StreakFlame({ streak }: StreakFlameProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`text-xl ${streak > 0 ? "" : "grayscale opacity-40"}`}>
        🔥
      </span>
      <span
        className={`text-sm font-bold ${
          streak > 0 ? "text-lingo-orange" : "text-lingo-gray-dark"
        }`}
      >
        {streak}
      </span>
    </div>
  );
}
