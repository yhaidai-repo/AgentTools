import { Lines } from "@/components/charts/Lines";
import { formatBytes } from "@/lib/format";
import { queryRange } from "@/lib/prometheus";
import type { MetricSeries } from "@/models/MetricSeries";

const HOURS = 24;
const STEP_SECONDS = 30 * 60;

// The PromQL of each chart: the last 24 h in 30-minute steps, each aggregated to one series.
const RATES = [
  { key: "requests", title: "HTTP requests per 30 min", query: "sum(increase(http_server_request_duration_seconds_count[30m]))", format: (value: number) => String(Math.round(value)) },
  { key: "p95", title: "HTTP p95, ms", query: "histogram_quantile(0.95, sum(rate(http_server_request_duration_seconds_bucket[30m])) by (le)) * 1000", format: (value: number) => String(Math.round(value)) },
  { key: "db", title: "Database operations per 30 min", query: "sum(increase(db_client_operation_duration_seconds_count[30m]))", format: (value: number) => String(Math.round(value)) },
  { key: "messages", title: "Messages handled per 30 min", query: "sum(increase(wolverine_messages_succeeded_Messages_total[30m]))", format: (value: number) => String(Math.round(value)) },
  { key: "memory", title: "Working set", query: "max(dotnet_process_memory_working_set_bytes)", format: formatBytes },
] as const;

type RateKey = (typeof RATES)[number]["key"];

export type Rates = Record<RateKey, MetricSeries | null>;

export async function loadRates(now: Date): Promise<Rates> {
  const from = new Date(now.getTime() - HOURS * 60 * 60 * 1000);
  const answers = await Promise.all(RATES.map((rate) => queryRange(rate.query, from, now, STEP_SECONDS)));

  return Object.fromEntries(RATES.map((rate, index) => [rate.key, answers[index]])) as Rates;
}

// PowerLoom's request, database, messaging and memory rates; the logs of the same hours are in Grafana (Loki).
export function RatesSection({ rates, grafana }: { rates: Rates; grafana: string | null }) {
  if (Object.values(rates).every((series) => series === null)) {
    return <p className="result-error">Prometheus (otel-lgtm) doesn&apos;t answer: no rates.</p>;
  }

  return (
    <>
      <div className="dashboard-charts">
        {RATES.map((rate) => <RateChart key={rate.key} title={rate.title} series={rates[rate.key]} format={rate.format} />)}
      </div>
      {grafana && <p className="muted">Logs and traces of the same hours: <a href={grafana} target="_blank" rel="noreferrer">Grafana Explore</a>.</p>}
    </>
  );
}

function RateChart({ title, series, format }: { title: string; series: MetricSeries | null; format: (value: number) => string }) {
  if (!series || series.values.every((value) => value === null)) {
    return <figure className="chart chart-empty"><figcaption>{title}</figcaption><p className="muted">No samples.</p></figure>;
  }

  return <Lines title={title} labels={series.times.map(timeLabel)} values={series.values} format={format} axisLabel={hourLabel} />;
}

// The viewer's clock isn't known on the server: UTC, said so. A step is its start: 09:00 covers 09:00 to 09:30.
function timeLabel(seconds: number): string {
  return `${new Date(seconds * 1000).toISOString().slice(11, 16)} UTC`;
}

function hourLabel(label: string): string {
  return label.slice(0, 5);
}
