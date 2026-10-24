import type { ChartBar } from "@/models/ChartBar";

interface HorizontalBarsProps {
  title: string;
  bars: ChartBar[];
  format: (value: number) => string;
  /** Shown instead of the bars when there are none. */
  empty: string;
}

// One bar per entity, longest first, each with its value at its end: for comparing entities, where the labels are too
// long for a column chart's x axis. HTML rather than SVG, so a label takes the room it needs.
export function HorizontalBars({ title, bars, format, empty }: HorizontalBarsProps) {
  const sorted = [...bars].sort((a, b) => b.value - a.value);
  const max = Math.max(...sorted.map((bar) => bar.value), 0);

  return (
    <figure className="panel chart">
      <figcaption>{title}</figcaption>
      {sorted.length === 0 && <p className="muted">{empty}</p>}
      <div className="bars" role="img" aria-label={title}>
        {sorted.map((bar) => (
          <div key={bar.key} className="bar-row" title={`${bar.label}: ${format(bar.value)}`}>
            <span className="bar-label">{bar.label}</span>
            <span className="bar-track"><span className="bar-fill" style={{ width: `${max > 0 ? (bar.value / max) * 100 : 0}%`, background: bar.color }} /></span>
            <span className="bar-value">{format(bar.value)}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}
