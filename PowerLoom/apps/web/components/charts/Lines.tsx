import { niceTicks } from "./chartScales";

const WIDTH = 640;
const HEIGHT = 200;
const MARGIN = { top: 16, right: 48, bottom: 28, left: 52 };
const TICKS = 3;
const MARKER_RADIUS = 4;

interface LinesProps {
  title: string;
  labels: string[];
  /** Null where there is no sample: the line breaks there instead of pretending. */
  values: (number | null)[];
  format: (value: number) => string;
  /** Short form of a label for the x axis; the full label stays in the tooltip. */
  axisLabel?: (label: string) => string;
}

// One series over time as a 2 px line with its last value labelled; each step has a hit area that tells its value on
// hover. One series needs no legend: the title names it.
export function Lines({ title, labels, values, format, axisLabel = (label) => label }: LinesProps) {
  const known = values.filter((value): value is number => value !== null);
  const ticks = niceTicks(Math.max(...known, 0), TICKS);
  const plot = { x: MARGIN.left, y: MARGIN.top, width: WIDTH - MARGIN.left - MARGIN.right, height: HEIGHT - MARGIN.top - MARGIN.bottom };
  const slot = values.length > 1 ? plot.width / (values.length - 1) : plot.width;
  const pointX = (index: number): number => plot.x + (values.length > 1 ? index * slot : plot.width / 2);
  const pointY = (value: number): number => plot.y + plot.height - plot.height * (ticks.max > 0 ? value / ticks.max : 0);
  const labelStep = Math.ceil(labels.length / 8);
  const last = values.length - 1 - [...values].reverse().findIndex((value) => value !== null);

  return (
    <figure className="chart">
      <figcaption>{title}</figcaption>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={title}>
        {ticks.values.map((tick) => (
          <g key={tick} className="chart-grid">
            <line x1={plot.x} x2={plot.x + plot.width} y1={pointY(tick)} y2={pointY(tick)} />
            <text x={plot.x - 6} y={pointY(tick) + 4}>{format(tick)}</text>
          </g>
        ))}
        {runs(values).map((run) => (
          <polyline key={run.start} className="chart-line" points={run.values.map((value, offset) => `${pointX(run.start + offset)},${pointY(value)}`).join(" ")} />
        ))}
        {values.map((value, index) => (
          <g key={index}>
            <rect className="chart-hit" x={pointX(index) - slot / 2} y={plot.y} width={slot} height={plot.height}>
              <title>{`${labels[index]}: ${value === null ? "no sample" : format(value)}`}</title>
            </rect>
            {index % labelStep === 0 && <text className="chart-axis" x={pointX(index)} y={HEIGHT - 10}>{axisLabel(labels[index])}</text>}
          </g>
        ))}
        {known.length > 0 && (
          <g>
            <circle className="chart-marker" cx={pointX(last)} cy={pointY(values[last] ?? 0)} r={MARKER_RADIUS} />
            <text className="chart-value chart-value-end" x={pointX(last) + 8} y={pointY(values[last] ?? 0) + 4}>{format(values[last] ?? 0)}</text>
          </g>
        )}
        <line className="chart-baseline" x1={plot.x} x2={plot.x + plot.width} y1={plot.y + plot.height} y2={plot.y + plot.height} />
      </svg>
    </figure>
  );
}

interface Run {
  start: number;
  values: number[];
}

// The stretches of consecutive samples; a lone sample still gets a (zero-length) line, the marker shows it.
function runs(values: (number | null)[]): Run[] {
  const result: Run[] = [];
  let current: Run | null = null;

  for (const [index, value] of values.entries()) {
    current = value === null ? null : extend(result, current, index, value);
  }

  return result;
}

function extend(result: Run[], current: Run | null, index: number, value: number): Run {
  if (current) {
    current.values.push(value);

    return current;
  }

  const run = { start: index, values: [value] };

  result.push(run);

  return run;
}
