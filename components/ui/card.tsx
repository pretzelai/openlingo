interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={`rounded-2xl bg-lingo-card border-2 border-lingo-border p-6 ${className}`}
    >
      {children}
    </div>
  );
}
