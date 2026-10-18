import type { ReactNode } from "react";
import type { ChartSeries } from "@/models/ChartSeries";
import type { StackSegment } from "@/models/StackSegment";
import { BAR_WIDTH, columnLayout, niceTicks } from "./chartScales";

const WIDTH = 640;
const HEIGHT = 220;
const MARGIN = { top: 16, right: 12, bottom: 28, left: 44 };
const SEPARATOR = 1;
const CORNER = 3;
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
// baseline. A column is one solid rounded shape with a hairline between its parts (user, 2026-10-18: separate rounded
// blocks made a 1-item part a floating dash); neighbours of the same colour (Ready for Release and Done) are one part,
// and one legend entry. Each part tells its values on hover.
export function StackedColumns({ title, aside, labels, series, format, axisLabel = (label) => label }: StackedColumnsProps) {
  const totals = labels.map((_, index) => series.reduce((sum, item) => sum + (item.values[index] ?? 0), 0));
  const ticks = niceTicks(Math.max(...totals, 0), TICKS);
  const plot = { x: MARGIN.left, y: MARGIN.top, width: WIDTH - MARGIN.left - MARGIN.right, height: HEIGHT - MARGIN.top - MARGIN.bottom };
  const layout = columnLayout(labels.length, plot.width, BAR_WIDTH);
  const scale = (value: number): number => plot.height * (ticks.max > 0 ? value / ticks.max : 0);
  const labelStep = Math.ceil(labels.length / 10);
  const peak = totals.indexOf(Math.max(...totals));
  const clipPrefix = `stack-${title.replace(/\W+/g, "-")}`;

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
        {labels.map((label, index) => {
          const x = plot.x + layout.offset(index);
          const clipId = `${clipPrefix}-${index}`;

          return (
            <g key={label} className="chart-column">
              <clipPath id={clipId}>
                <rect x={x} y={plot.y + plot.height - scale(totals[index])} width={layout.width} height={scale(totals[index])} rx={CORNER} />
              </clipPath>
              <g clipPath={`url(#${clipId})`}>
                {stack(series, index).map((segment, position) => (
                  <rect
                    key={segment.key}
                    className="chart-segment"
                    x={x}
                    y={plot.y + plot.height - scale(segment.top)}
                    width={layout.width}
                    height={Math.max(scale(segment.value) - (position > 0 ? SEPARATOR : 0), 0)}
                    fill={segment.color}
                  >
                    <title>{`${label} · ${segment.label}: ${segment.values.map(format).join(" + ")}`}</title>
                  </rect>
                ))}
              </g>
              {index === peak && totals[index] > 0 && (
                <text className="chart-value" x={x + layout.width / 2} y={plot.y + plot.height - scale(totals[index]) - 4}>{format(totals[index])}</text>
              )}
              {index % labelStep === 0 && (
                <text className="chart-axis" x={x + layout.width / 2} y={HEIGHT - 10}>{axisLabel(label)}</text>
              )}
            </g>
          );
        })}
        <line className="chart-baseline" x1={plot.x} x2={plot.x + plot.width} y1={plot.y + plot.height} y2={plot.y + plot.height} />
      </svg>
      {series.length > 1 && (
        <ul className="chart-legend">
          {legendOf(series).map((item) => (
            <li key={item.color}><span className="chart-swatch" style={{ background: item.color }} />{item.label}</li>
          ))}
        </ul>
      )}
    </figure>
  );
}

// The non-empty parts of one column, bottom-up in the series' fixed order; a part of the same colour as the one below
// joins it, so the column shows one block of that colour.
function stack(series: ChartSeries[], index: number): StackSegment[] {
  const segments: StackSegment[] = [];
  let top = 0;

  for (const item of series.filter((candidate) => (candidate.values[index] ?? 0) > 0)) {
    top += item.values[index];
    addSegment(segments, item, item.values[index], top);
  }

  return segments;
}

function addSegment(segments: StackSegment[], item: ChartSeries, value: number, top: number): void {
  const below = segments.at(-1);

  if (below?.color === item.color) {
    below.label = `${below.label} / ${item.label}`;
    below.values.push(value);
    below.value += value;
    below.top = top;

    return;
  }

  segments.push({ key: item.key, label: item.label, color: item.color, value, values: [value], top });
}

// One legend entry per colour: series that share a colour are named together.
function legendOf(series: ChartSeries[]): { color: string; label: string }[] {
  const byColor = new Map<string, string[]>();

  for (const item of series) {
    byColor.set(item.color, [...(byColor.get(item.color) ?? []), item.label]);
  }

  return [...byColor].map(([color, names]) => ({ color, label: names.join(" / ") }));
}
