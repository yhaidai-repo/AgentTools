import type { AgentMetric } from "@/models/AgentMetric";
import { formatDuration, formatTokens, formatUsd } from "./format";

// The per-day chart's views, stacked by agent (user request 2026-10-18: a switch between cost, tokens and duration).
export const AGENT_METRICS: Record<string, AgentMetric> = {
  cost: { label: "Cost", title: "Cost per day", byAgent: (day) => day.costByAgent, format: formatUsd },
  tokens: { label: "Tokens", title: "Tokens per day", byAgent: (day) => day.tokensByAgent, format: formatTokens },
  duration: { label: "Duration", title: "Duration per day", byAgent: (day) => day.durationMsByAgent, format: formatDuration },
};

export const DEFAULT_AGENT_METRIC = "cost";

export function agentMetricOf(key: string | undefined): string {
  return key && key in AGENT_METRICS ? key : DEFAULT_AGENT_METRIC;
}

export function agentMetricOptions(): { key: string; label: string }[] {
  return Object.entries(AGENT_METRICS).map(([key, { label }]) => ({ key, label }));
}
