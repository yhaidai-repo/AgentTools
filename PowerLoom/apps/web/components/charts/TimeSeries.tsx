import { niceTicks } from "./chartScales";

export interface TimePoint { at: string; value: number | null; observedMinutes: number }
interface TimeSeriesProps {
  title: string;
  points: TimePoint[];
  format: (value: number) => string;
  color: string;
}

const WIDTH = 360;
const HEIGHT = 210;
const plot = { x: 56, y: 12, width: 290, height: 166 };
const timeLabel = (at: string) => new Date(at).toISOString().slice(11, 16);

// Separate paths keep missing observations visible. A zero is a measurement, not a missing value.
export function TimeSeries({ title, points, format, color }: TimeSeriesProps) {
  const ticks = niceTicks(Math.max(0, ...points.map(point => point.value ?? 0)), 3);
  const x = (index: number) => plot.x + index * plot.width / Math.max(points.length - 1, 1);
  const y = (value: number) => plot.y + plot.height * (1 - value / (ticks.max || 1));
  const segments: string[][] = [];
  let segment: string[] = [];
  for (const [index, point] of points.entries()) {
    if (point.value === null) { if (segment.length) segments.push(segment); segment = []; }
    else segment.push(`${x(index)},${y(point.value)}`);
  }
  if (segment.length) segments.push(segment);
  const last = points.findLast(point => point.value !== null);
  const axis = points.length ? [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])] : [];

  return (
    <figure className="panel chart performance-chart">
      <figcaption>{title}</figcaption>
      <p className="performance-value">{last?.value != null ? format(last.value) : "—"}<span>Last observed interval</span></p>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={`${title}, last 24 hours; times in UTC`}>
        {ticks.values.map(tick => <g key={tick} className="chart-grid">
          <line x1={plot.x} x2={plot.x + plot.width} y1={y(tick)} y2={y(tick)} />
          <text x={plot.x - 8} y={y(tick) + 4}>{format(tick)}</text>
        </g>)}
        {segments.map((coordinates, index) => <polyline key={index} points={coordinates.join(" ")} fill="none" stroke={color} strokeWidth="2.5" />)}
        {points.map((point, index) => point.value === null ? null : <circle key={point.at} cx={x(index)} cy={y(point.value)} r="1.8" fill={color}>
          <title>{`${new Date(point.at).toISOString().slice(0, 16).replace("T", " ")} UTC · ${format(point.value)} · ${point.observedMinutes}/5 minutes observed`}</title>
        </circle>)}
        {axis.map(index => <text key={index} className="chart-axis" x={x(index)} y={HEIGHT - 14}>{timeLabel(points[index].at)}</text>)}
      </svg>
    </figure>
  );
}
