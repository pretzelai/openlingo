interface UnitCardProps {
  title: string;
  description: string;
  icon: string;
  color: string;
  unitIndex: number;
  totalLessons: number;
  completedLessons: number;
  children: React.ReactNode;
}

export function UnitCard({
  title,
  description,
  icon,
  color,
  totalLessons,
  completedLessons,
  children,
}: UnitCardProps) {
  const progress = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

  return (
    <div className="mb-8">
      <div className="flex items-center gap-3 mb-4 px-2">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl text-2xl"
          style={{ backgroundColor: color + "20" }}
        >
          {icon}
        </div>
        <div className="flex-1">
          <h3 className="text-lg font-bold text-lingo-text">{title}</h3>
          <p className="text-sm text-lingo-text-light">{description}</p>
        </div>
        <div className="text-right">
          <span className="text-sm font-bold" style={{ color }}>
            {completedLessons}/{totalLessons}
          </span>
          <div className="mt-1 h-2 w-20 rounded-full bg-lingo-gray overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, backgroundColor: color }}
            />
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center gap-4 py-4">{children}</div>
    </div>
  );
}
