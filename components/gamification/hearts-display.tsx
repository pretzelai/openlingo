interface HeartsDisplayProps {
  hearts: number;
  maxHearts: number;
}

export function HeartsDisplay({ hearts, maxHearts }: HeartsDisplayProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-lg text-lingo-red">&#10084;</span>
      <span
        className={`text-sm font-bold ${
          hearts > 0 ? "text-lingo-red" : "text-lingo-gray-dark"
        }`}
      >
        {hearts}
      </span>
    </div>
  );
}
