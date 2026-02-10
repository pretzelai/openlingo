interface LevelBadgeProps {
  level: number;
  size?: "sm" | "md" | "lg";
}

const sizeMap = {
  sm: "h-8 w-8 text-xs",
  md: "h-12 w-12 text-sm",
  lg: "h-16 w-16 text-lg",
};

export function LevelBadge({ level, size = "md" }: LevelBadgeProps) {
  return (
    <div
      className={`flex items-center justify-center rounded-full bg-lingo-yellow text-white font-black ${sizeMap[size]}`}
    >
      {level}
    </div>
  );
}
