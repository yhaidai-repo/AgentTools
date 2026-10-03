import { budgetDayStart } from "@agenttools/usage";

const HOUR = 60 * 60 * 1000;

// Each period's start. "Today" is the daily budgets' day (AgentUsage: from 00:00 UTC).
export const RANGES: Record<string, { label: string; start: (now: Date) => Date }> = {
  "1h": { label: "1 h", start: (now) => new Date(now.getTime() - HOUR) },
  today: { label: "Today", start: budgetDayStart },
  "24h": { label: "24 h", start: (now) => new Date(now.getTime() - 24 * HOUR) },
  "7d": { label: "7 days", start: (now) => new Date(now.getTime() - 7 * 24 * HOUR) },
  "30d": { label: "30 days", start: (now) => new Date(now.getTime() - 30 * 24 * HOUR) },
  "90d": { label: "90 days", start: (now) => new Date(now.getTime() - 90 * 24 * HOUR) },
  all: { label: "All", start: () => new Date(0) },
};

export const DEFAULT_RANGE = "7d";

export function rangeStart(range: string): Date {
  return (RANGES[range] ?? RANGES[DEFAULT_RANGE]).start(new Date());
}

// For the client-side period filter (functions can't cross to the browser).
export function rangeOptions(): { key: string; label: string }[] {
  return Object.entries(RANGES).map(([key, { label }]) => ({ key, label }));
}
