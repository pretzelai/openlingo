import type { ButtonHTMLAttributes, ReactNode } from "react";

export function Button({ children, className = "", variant = "primary", loading, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode; variant?: "primary" | "secondary" | "danger"; loading?: boolean }) {
  const variants = {
    primary: "bg-lingo-green text-white border-lingo-green-dark hover:bg-lingo-green/90",
    secondary: "bg-white text-lingo-text border-lingo-border hover:border-lingo-blue",
    danger: "bg-lingo-red text-white border-lingo-red-dark hover:bg-lingo-red/90",
  };
  return <button {...props} disabled={props.disabled || loading} className={`rounded-xl border-2 px-4 py-2.5 text-sm font-black shadow-[0_2px_0_0] transition active:translate-y-[1px] active:shadow-none disabled:opacity-50 ${variants[variant]} ${className}`}>{loading ? "Loading..." : children}</button>;
}
