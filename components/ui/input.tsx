"use client";

import { InputHTMLAttributes, forwardRef } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className = "", ...props }, ref) => {
    return (
      <div className="w-full">
        {label && (
          <label className="mb-1.5 block text-sm font-bold text-lingo-text-light uppercase tracking-wide">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`w-full rounded-xl border-2 border-lingo-border bg-white px-4 py-3 text-base text-lingo-text placeholder:text-lingo-gray-dark focus:border-lingo-blue focus:outline-none transition-colors ${
            error ? "border-lingo-red" : ""
          } ${className}`}
          {...props}
        />
        {error && (
          <p className="mt-1 text-sm text-lingo-red font-medium">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";
