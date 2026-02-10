import { getXpProgress } from "@/lib/game/levels";

interface XpDisplayProps {
  xp: number;
  level: number;
  compact?: boolean;
}

export function XpDisplay({ xp, level, compact = false }: XpDisplayProps) {
  const { current, needed, percentage } = getXpProgress(xp);

  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-sm font-bold text-lingo-yellow">{xp} XP</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-lingo-yellow text-white font-black text-sm">
        {level}
      </div>
      <div className="flex-1">
        <div className="flex justify-between text-xs font-bold">
          <span className="text-lingo-text">Level {level}</span>
          <span className="text-lingo-text-light">
            {current}/{needed} XP
          </span>
        </div>
        <div className="mt-1 h-3 w-full rounded-full bg-lingo-gray overflow-hidden">
          <div
            className="h-full rounded-full bg-lingo-yellow transition-all duration-500"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>
    </div>
  );
}
