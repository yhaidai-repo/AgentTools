import { Panel } from "@/components/Panel";
import { Sparkline } from "@/components/charts/Sparkline";
import { formatBytes } from "@/lib/format";
import { queryRange } from "@/lib/prometheus";
import type { MetricSeries } from "@/models/MetricSeries";

const HOURS = 24;
const STEP_SECONDS = 30 * 60;

// The PromQL of each tile: the last 24 h in 30-minute steps, each aggregated to one series.
const RATES = [
  { key: "requests", title: "HTTP requests", unit: "per 30 min", query: "sum(increase(http_server_request_duration_seconds_count[30m]))", format: (value: number) => String(Math.round(value)) },
  { key: "p95", title: "HTTP p95", unit: "ms", query: "histogram_quantile(0.95, sum(rate(http_server_request_duration_seconds_bucket[30m])) by (le)) * 1000", format: (value: number) => String(Math.round(value)) },
  { key: "db", title: "Database operations", unit: "per 30 min", query: "sum(increase(db_client_operation_duration_seconds_count[30m]))", format: (value: number) => String(Math.round(value)) },
  { key: "messages", title: "Messages handled", unit: "per 30 min", query: "sum(increase(wolverine_messages_succeeded_Messages_total[30m]))", format: (value: number) => String(Math.round(value)) },
  { key: "memory", title: "Working set", unit: "", query: "max(dotnet_process_memory_working_set_bytes)", format: formatBytes },
] as const;

type RateKey = (typeof RATES)[number]["key"];

export type Rates = Record<RateKey, MetricSeries | null>;

export async function loadRates(now: Date): Promise<Rates> {
  const from = new Date(now.getTime() - HOURS * 60 * 60 * 1000);
  const answers = await Promise.all(RATES.map((rate) => queryRange(rate.query, from, now, STEP_SECONDS)));

  return Object.fromEntries(RATES.map((rate, index) => [rate.key, answers[index]])) as Rates;
}

export function hasRates(rates: Rates): boolean {
  return Object.values(rates).some((series) => series !== null);
}

// The last sample of a series; null when it has none.
export function latestRate(series: MetricSeries | null): number | null {
  return series?.values.findLast((value) => value !== null) ?? null;
}

// PowerLoom's request, database, messaging and memory rates as small trend tiles: the latest value large, the day's
// line under it; the logs of the same hours are in Grafana (Loki).
export function RatesSection({ rates, grafana }: { rates: Rates; grafana: string | null }) {
  if (!hasRates(rates)) {
    return <Panel tone="warn"><p className="text-warn">Prometheus (otel-lgtm) doesn&apos;t answer: no rates.</p></Panel>;
  }

  return (
    <>
      <div className="grid three">
        {RATES.map((rate) => <RateTile key={rate.key} title={rate.title} unit={rate.unit} series={rates[rate.key]} format={rate.format} />)}
      </div>
      {grafana && <p className="text-faint rates-note">Logs and traces of the same hours: <a href={grafana} target="_blank" rel="noreferrer">Grafana Explore</a>.</p>}
    </>
  );
}

function RateTile({ title, unit, series, format }: { title: string; unit: string; series: MetricSeries | null; format: (value: number) => string }) {
  const latest = latestRate(series);

  return (
    <Panel title={title}>
      <div className="rate-value">{latest === null ? "–" : format(latest)}{unit && <small>{unit}</small>}</div>
      {series && latest !== null ? <Sparkline values={series.values} label={title} /> : <p className="empty">No samples.</p>}
    </Panel>
  );
}
