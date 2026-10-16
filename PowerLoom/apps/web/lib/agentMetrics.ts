import type { AgentMetric } from "@/models/AgentMetric";
import { average, formatDuration, formatUsd } from "./format";

// The agent chart's choices (user request 2026-10-16). Duration is per finished run: a day's total grows with its runs,
// which the runs chart already shows.
export const AGENT_METRICS: Record<string, AgentMetric> = {
  cost: { label: "Cost", value: (day) => day.costUsd, format: formatUsd },
  duration: { label: "Duration per run", value: (day) => average(day.durationMs, day.finishedRuns), format: formatDuration },
  runs: { label: "Runs", value: (day) => day.runs, format: String },
};

export const DEFAULT_AGENT_METRIC = "cost";

export function agentMetricOf(key: string | undefined): string {
  return key && key in AGENT_METRICS ? key : DEFAULT_AGENT_METRIC;
}

// For the client-side filter (functions can't cross to the browser).
export function agentMetricOptions(): { key: string; label: string }[] {
  return Object.entries(AGENT_METRICS).map(([key, { label }]) => ({ key, label }));
}
