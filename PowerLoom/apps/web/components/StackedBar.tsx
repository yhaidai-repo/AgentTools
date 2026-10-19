import type { BarPart } from "@/models/BarPart";

// A thin bar of parts with the total next to it (user decision 2026-10-18): how a count splits, e.g. a note's reads,
// searches, shell uses and writes, or a tool's ok, refused, denied and failed calls. The counts are in its tooltip.
export function StackedBar({ parts }: { parts: BarPart[] }) {
  const total = parts.reduce((sum, part) => sum + part.value, 0);
  const shown = parts.filter((part) => part.value > 0);

  return (
    <div className="stacked" title={shown.map((part) => `${part.value} ${part.label}`).join(" · ")}>
      <div className="stacked-bar">
        {shown.map((part) => <b key={part.label} className={part.className} style={{ width: `${(part.value / total) * 100}%` }} />)}
      </div>
      <span className="stacked-total">{total}</span>
    </div>
  );
}

// The colour key of a stacked bar, for a panel's header.
export function BarLegend({ parts }: { parts: Pick<BarPart, "label" | "className">[] }) {
  return (
    <span className="bar-legend">
      {parts.map((part) => <span key={part.label}><i className={part.className} />{part.label}</span>)}
    </span>
  );
}
