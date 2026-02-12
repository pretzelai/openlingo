import { HoverableText } from "@/components/word/hoverable-text";

interface UnitCardProps {
  title: string;
  description: string;
  icon: string;
  color: string;
  totalLessons: number;
  completedLessons: number;
  languageLabel?: string;
  language?: string;
  onClick?: () => void;
  children?: React.ReactNode;
}

export function UnitCard({
  title,
  description,
  icon,
  color,
  totalLessons,
  completedLessons,
  languageLabel,
  language,
  onClick,
  children,
}: UnitCardProps) {
  const progress = totalLessons > 0 ? (completedLessons / totalLessons) * 100 : 0;

  if (onClick) {
    return (
      <button
        onClick={onClick}
        className="w-full rounded-2xl border-2 border-lingo-gray bg-white p-4 text-left transition-transform hover:scale-[1.02] active:scale-[0.98]"
      >
        <div className="flex items-center gap-3">
          <div
            className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-2xl"
            style={{ backgroundColor: color + "20" }}
          >
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-lg font-bold text-lingo-text">{title}</h3>
            <p className="text-sm text-lingo-text-light">{description}</p>
            {languageLabel && (
              <p className="text-xs text-lingo-text-light mt-0.5">{languageLabel}</p>
            )}
          </div>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <div className="h-2 flex-1 rounded-full bg-lingo-gray overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${progress}%`, backgroundColor: color }}
            />
          </div>
          <span className="text-sm font-bold" style={{ color }}>
            {completedLessons}/{totalLessons}
          </span>
        </div>
      </button>
    );
  }

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
          <h3 className="text-lg font-bold text-lingo-text">{language ? <HoverableText text={title} language={language} /> : title}</h3>
          <p className="text-sm text-lingo-text-light">{description}</p>
          {languageLabel && (
            <p className="text-xs text-lingo-text-light mt-0.5">{languageLabel}</p>
          )}
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
