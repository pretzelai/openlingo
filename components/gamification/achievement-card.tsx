interface AchievementCardProps {
  icon: string;
  title: string;
  description: string;
  unlocked: boolean;
  unlockedAt?: string;
}

export function AchievementCard({
  icon,
  title,
  description,
  unlocked,
}: AchievementCardProps) {
  return (
    <div
      className={`flex items-center gap-3 rounded-xl border-2 p-4 transition-all ${
        unlocked
          ? "border-lingo-yellow bg-yellow-50"
          : "border-lingo-border bg-white opacity-50 grayscale"
      }`}
    >
      <span className="text-3xl">{icon}</span>
      <div>
        <h4 className="font-bold text-lingo-text">{title}</h4>
        <p className="text-xs text-lingo-text-light">{description}</p>
      </div>
      {unlocked && (
        <span className="ml-auto text-lingo-yellow text-xl">&#10003;</span>
      )}
    </div>
  );
}
