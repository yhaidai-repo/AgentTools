import type { MetricSeries } from "@/models/MetricSeries";
import { isObservabilityOn } from "./observability";

const TIMEOUT_MS = 5_000;

interface RangeAnswer {
  status: string;
  data?: { result: { values: [number, string][] }[] };
}

// The web asks Prometheus in otel-lgtm directly over the compose network (user decision 2026-10-11). An expression
// that aggregates to one series; null when Prometheus doesn't answer or observability is off, so the page says so
// instead of failing.
export async function queryRange(expression: string, from: Date, to: Date, stepSeconds: number): Promise<MetricSeries | null> {
  if (!isObservabilityOn()) {
    return null;
  }

  const start = Math.floor(seconds(from) / stepSeconds) * stepSeconds;
  const end = seconds(to);
  const url = `${baseUrl()}/api/v1/query_range?${new URLSearchParams({ query: expression, start: String(start), end: String(end), step: String(stepSeconds) })}`;

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), cache: "no-store" });
    const answer = (await response.json()) as RangeAnswer;

    return answer.status === "success" ? toSeries(answer.data?.result[0]?.values ?? [], start, end, stepSeconds) : null;
  } catch {
    return null;
  }
}

// Where the logs of the same period are: Grafana's Explore on Loki, as the PC reaches it.
export function grafanaExploreUrl(): string | null {
  const grafana = process.env.GRAFANA_URL?.replace(/\/+$/, "");

  return grafana ? `${grafana}/explore` : null;
}

function baseUrl(): string {
  return (process.env.PROMETHEUS_URL ?? "").trim().replace(/\/+$/, "");
}

function seconds(date: Date): number {
  return Math.floor(date.getTime() / 1000);
}

// The whole step grid (aligned to the step, so the labels read 09:00, 09:30): Prometheus leaves out the steps without
// a sample, the chart shows them as gaps.
function toSeries(values: [number, string][], start: number, end: number, stepSeconds: number): MetricSeries {
  const samples = new Map(values.map(([time, value]) => [time, Number(value)]));
  const times: number[] = [];

  for (let time = start; time <= end; time += stepSeconds) {
    times.push(time);
  }

  return { times, values: times.map((time) => sampleAt(samples, time)) };
}

function sampleAt(samples: Map<number, number>, time: number): number | null {
  const value = samples.get(time);

  return value !== undefined && Number.isFinite(value) ? value : null;
}
