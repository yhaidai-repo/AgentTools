import type { ChartSeries } from "@/models/ChartSeries";
import { columnLayout, niceTicks } from "./chartScales";

const WIDTH = 640;
const HEIGHT = 220;
const MARGIN = { top: 16, right: 12, bottom: 28, left: 44 };
const MAX_GROUP_WIDTH = 40;
const GAP = 2;
const TICKS = 3;

interface GroupedColumnsProps {
  title: string;
  labels: string[];
  series: ChartSeries[];
  format: (value: number) => string;
  /** Short form of a label for the x axis; the full label stays in the tooltip. */
  axisLabel?: (label: string) => string;
}

// Hand-rolled SVG like StackedColumns, for values that compare rather than add up (e.g. estimate and actual): the
// series stand side by side in each label's slot; each column tells its value on hover; the legend names the series.
export function GroupedColumns({ title, labels, series, format, axisLabel = (label) => label }: GroupedColumnsProps) {
  const ticks = niceTicks(Math.max(...series.flatMap((item) => item.values), 0), TICKS);
  const plot = { x: MARGIN.left, y: MARGIN.top, width: WIDTH - MARGIN.left - MARGIN.right, height: HEIGHT - MARGIN.top - MARGIN.bottom };
  const group = columnLayout(labels.length, plot.width, MAX_GROUP_WIDTH);
  const columnWidth = Math.max(group.width / Math.max(series.length, 1) - GAP, 1);
  const scale = (value: number): number => plot.height * (ticks.max > 0 ? value / ticks.max : 0);
  const labelStep = Math.ceil(labels.length / 10);

  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={title}>
        {ticks.values.map((tick) => (
          <g key={tick} className="chart-grid">
            <line x1={plot.x} x2={plot.x + plot.width} y1={plot.y + plot.height - scale(tick)} y2={plot.y + plot.height - scale(tick)} />
            <text x={plot.x - 6} y={plot.y + plot.height - scale(tick) + 4}>{format(tick)}</text>
          </g>
        ))}
        {labels.map((label, index) => (
          <g key={label} className="chart-column">
            {series.map((item, position) => (
              <rect
                key={item.key}
                x={plot.x + group.offset(index) + position * (columnWidth + GAP)}
                y={plot.y + plot.height - scale(item.values[index] ?? 0)}
                width={columnWidth}
                height={scale(item.values[index] ?? 0)}
                fill={item.color}
              >
                <title>{`${label} · ${item.label}: ${format(item.values[index] ?? 0)}`}</title>
              </rect>
            ))}
            {index % labelStep === 0 && (
              <text className="chart-axis" x={plot.x + group.offset(index) + group.width / 2} y={HEIGHT - 10}>{axisLabel(label)}</text>
            )}
          </g>
        ))}
        <line className="chart-baseline" x1={plot.x} x2={plot.x + plot.width} y1={plot.y + plot.height} y2={plot.y + plot.height} />
      </svg>
      <ul className="chart-legend">
        {series.map((item) => (
          <li key={item.key}><span className="chart-swatch" style={{ background: item.color }} />{item.label}</li>
        ))}
      </ul>
    </figure>
  );
}
