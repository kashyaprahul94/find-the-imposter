"use client";

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

type Tone = "neon" | "cyan" | "amber" | "ghost";

const TONE: Record<Tone, string> = {
  neon: "text-neon bg-neon/10",
  cyan: "text-cyan bg-cyan/10",
  amber: "text-amber bg-amber/10",
  ghost: "text-ash bg-transparent",
};

export function Button({
  tone = "cyan",
  className = "",
  children,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }) {
  return (
    <button
      {...props}
      // min-h-14: thumb-sized target for a phone passed around a table.
      className={`btn-arcade min-h-14 w-full px-5 py-3 font-display text-[11px] leading-relaxed tracking-wider uppercase disabled:cursor-not-allowed ${TONE[tone]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Field({
  label,
  hint,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  return (
    <label className="block">
      <span className="mb-1 block font-display text-[10px] tracking-widest text-ash uppercase">
        {label}
      </span>
      <input
        {...props}
        className={`w-full border-2 border-edge bg-panel px-3 py-3 text-bone caret-neon outline-none placeholder:text-ash/50 focus:border-cyan focus:text-glow-cyan ${className}`}
      />
      {hint ? <span className="mt-1 block text-[15px] text-ash">{hint}</span> : null}
    </label>
  );
}

export function Panel({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`border-2 border-edge bg-panel/70 p-4 ${className}`}>{children}</div>
  );
}

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <h1
      className={`flicker font-display leading-none tracking-tight ${
        small ? "text-base" : "text-2xl sm:text-3xl"
      }`}
    >
      <span className="text-neon text-glow-neon">IMPO</span>
      <span className="text-cyan text-glow-cyan">STER</span>
    </h1>
  );
}

export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="border-l-4 border-neon bg-neon/10 px-3 py-2 text-[17px] text-neon">
      {children}
    </p>
  );
}
