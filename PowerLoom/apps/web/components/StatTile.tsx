import type { ReactNode } from "react";
import { toneClass } from "@/lib/tone";
import type { Tone } from "@/models/Tone";

interface StatTileProps {
  label: ReactNode;
  value: string;
  note?: ReactNode;
  /** Good lights the number; warn and error breathe the tile's outline (user decision 2026-10-18). */
  tone?: Tone;
  /** Under the note, e.g. a meter. */
  children?: ReactNode;
}

// One number with its label and a note under it (the dashboard's tiles).
export function StatTile({ label, value, note, tone = "plain", children }: StatTileProps) {
  return (
    <div className={`tile${toneClass(tone)}`}>
      <div className="tile-label">{label}</div>
      <div className="tile-value">{value}</div>
      {note && <div className="tile-note">{note}</div>}
      {children}
    </div>
  );
}
