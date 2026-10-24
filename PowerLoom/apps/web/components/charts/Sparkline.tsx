const WIDTH = 200;
const HEIGHT = 48;

interface Point {
  x: number;
  y: number;
}

// A small trend line with a soft fill under it (the Application tab's rate tiles); gaps where there is no sample. The
// line keeps its width however wide the tile is.
export function Sparkline({ values, label }: { values: (number | null)[]; label: string }) {
  const known = values.filter((value): value is number => value !== null);
  const max = Math.max(...known, 0);
  const step = values.length > 1 ? WIDTH / (values.length - 1) : WIDTH;
  const toY = (value: number): number => HEIGHT - 4 - (max > 0 ? (value / max) * (HEIGHT - 8) : 0);

  return (
    <svg className="sparkline" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="none" role="img" aria-label={label}>
      {stretches(values).map((stretch) => {
        const points = stretch.map((sample) => ({ x: sample.index * step, y: toY(sample.value) }));

        return (
          <g key={stretch[0].index}>
            <polygon className="sparkline-area" points={areaOf(points)} />
            <polyline className="sparkline-line" points={pointsOf(points)} />
          </g>
        );
      })}
    </svg>
  );
}

interface Sample {
  index: number;
  value: number;
}

// The runs of consecutive samples; a missing sample breaks the line instead of pretending.
function stretches(values: (number | null)[]): Sample[][] {
  const result: Sample[][] = [];

  values.forEach((value, index) => addSample(result, values[index - 1] ?? null, index, value));

  return result;
}

function addSample(result: Sample[][], previous: number | null, index: number, value: number | null): void {
  if (value === null) {
    return;
  }

  if (previous === null || result.length === 0) {
    result.push([]);
  }

  result[result.length - 1].push({ index, value });
}

function pointsOf(points: Point[]): string {
  return points.map((point) => `${point.x},${point.y}`).join(" ");
}

function areaOf(points: Point[]): string {
  const first = points[0];
  const last = points[points.length - 1];

  return `${pointsOf(points)} ${last.x},${HEIGHT} ${first.x},${HEIGHT}`;
}
