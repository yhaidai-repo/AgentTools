import type { ReactNode } from "react";
import type { ChartSeries } from "@/models/ChartSeries";
import { BAR_WIDTH, columnLayout, niceTicks } from "./chartScales";

const WIDTH = 640;
const HEIGHT = 220;
const MARGIN = { top: 16, right: 12, bottom: 28, left: 44 };
const GAP = 2;
const TICKS = 3;

interface StackedColumnsProps {
  title: string;
  /** Beside the title on the right, e.g. a switch of what the chart shows. */
  aside?: ReactNode;
  labels: string[];
  series: ChartSeries[];
  format: (value: number) => string;
  /** Short form of a label for the x axis (e.g. the day of month); the full label stays in the tooltip. */
  axisLabel?: (label: string) => string;
}

// Hand-rolled SVG (no chart library, user decision 2026-10-11): one column per label, the series stacked from the
// baseline with a surface gap between segments; each segment tells its value on hover; the legend names the series.
export function StackedColumns({ title, aside, labels, series, format, axisLabel = (label) => label }: StackedColumnsProps) {
  const totals = labels.map((_, index) => series.reduce((sum, item) => sum + (item.values[index] ?? 0), 0));
  const ticks = niceTicks(Math.max(...totals, 0), TICKS);
  const plot = { x: MARGIN.left, y: MARGIN.top, width: WIDTH - MARGIN.left - MARGIN.right, height: HEIGHT - MARGIN.top - MARGIN.bottom };
  const layout = columnLayout(labels.length, plot.width, BAR_WIDTH);
  const scale = (value: number): number => plot.height * (ticks.max > 0 ? value / ticks.max : 0);
  const labelStep = Math.ceil(labels.length / 10);
  const peak = totals.indexOf(Math.max(...totals));

  return (
    <figure className="panel chart">
      <figcaption>{title}{aside}</figcaption>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={title}>
        {ticks.values.map((tick) => (
          <g key={tick} className="chart-grid">
            <line x1={plot.x} x2={plot.x + plot.width} y1={plot.y + plot.height - scale(tick)} y2={plot.y + plot.height - scale(tick)} />
            <text x={plot.x - 6} y={plot.y + plot.height - scale(tick) + 4}>{format(tick)}</text>
          </g>
        ))}
        {labels.map((label, index) => (
          <g key={label} className="chart-column">
            {stack(series, index).map((segment) => (
              <rect
                key={segment.key}
                x={plot.x + layout.offset(index)}
                y={plot.y + plot.height - scale(segment.top)}
                width={layout.width}
                height={Math.max(scale(segment.value) - GAP, 0)}
                fill={segment.color}
              >
                <title>{`${label} · ${segment.label}: ${format(segment.value)}`}</title>
              </rect>
            ))}
            {index === peak && totals[index] > 0 && (
              <text className="chart-value" x={plot.x + layout.offset(index) + layout.width / 2} y={plot.y + plot.height - scale(totals[index]) - 4}>{format(totals[index])}</text>
            )}
            {index % labelStep === 0 && (
              <text className="chart-axis" x={plot.x + layout.offset(index) + layout.width / 2} y={HEIGHT - 10}>{axisLabel(label)}</text>
            )}
          </g>
        ))}
        <line className="chart-baseline" x1={plot.x} x2={plot.x + plot.width} y1={plot.y + plot.height} y2={plot.y + plot.height} />
      </svg>
      {series.length > 1 && (
        <ul className="chart-legend">
          {series.map((item) => (
            <li key={item.key}><span className="chart-swatch" style={{ background: item.color }} />{item.label}</li>
          ))}
        </ul>
      )}
    </figure>
  );
}

interface Segment {
  key: string;
  label: string;
  color: string;
  value: number;
  /** The segment's upper edge, counted from the baseline. */
  top: number;
}

// The non-empty segments of one column, bottom-up, in the series' fixed order.
function stack(series: ChartSeries[], index: number): Segment[] {
  const segments: Segment[] = [];
  let top = 0;

  for (const item of series) {
    const value = item.values[index] ?? 0;

    if (value > 0) {
      top += value;
      segments.push({ key: item.key, label: item.label, color: item.color, value, top });
    }
  }

  return segments;
}
