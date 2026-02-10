"use client";

import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost" | "outline";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

const variantStyles: Record<Variant, string> = {
  primary:
    "bg-lingo-green text-white border-b-4 border-lingo-green-dark hover:bg-lingo-green/90 active:border-b-0 active:mt-1",
  secondary:
    "bg-lingo-blue text-white border-b-4 border-lingo-blue-dark hover:bg-lingo-blue/90 active:border-b-0 active:mt-1",
  danger:
    "bg-lingo-red text-white border-b-4 border-lingo-red-dark hover:bg-lingo-red/90 active:border-b-0 active:mt-1",
  ghost:
    "bg-transparent text-lingo-text hover:bg-lingo-gray/50",
  outline:
    "bg-white text-lingo-text border-2 border-lingo-border hover:bg-lingo-gray/30",
};

const sizeStyles: Record<Size, string> = {
  sm: "px-4 py-1.5 text-sm rounded-xl",
  md: "px-6 py-2.5 text-base rounded-xl",
  lg: "px-8 py-3 text-lg rounded-2xl",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "primary", size = "md", loading, className = "", children, disabled, ...props }, ref) => {
    return (
      <button
        ref={ref}
        disabled={disabled || loading}
        className={`font-bold uppercase tracking-wide transition-all duration-100 disabled:opacity-50 disabled:cursor-not-allowed ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Loading...
          </span>
        ) : (
          children
        )}
      </button>
    );
  }
);

Button.displayName = "Button";
