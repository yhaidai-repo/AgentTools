import type { ReactNode } from "react";

interface HeroStatProps {
  label: string;
  value: string;
  /** Small text after the value, e.g. "1 fixed", "of $30". */
  note?: string;
  /** Warn breathes amber; error turns the value rose. */
  tone?: "warn" | "error";
  /** Under the value, e.g. a meter. */
  children?: ReactNode;
}

// One number in a detail page's header (PBI, task, review, agent).
export function HeroStat({ label, value, note, tone, children }: HeroStatProps) {
  return (
    <div className={`hero-stat${tone ? ` ${tone}` : ""}`}>
      <div className="hero-stat-label">{label}</div>
      <div className="hero-stat-value">{value}{note && <small>{note}</small>}</div>
      {children}
    </div>
  );
}
