const HOUR = 60 * 60 * 1000;

export const RANGES: Record<string, { label: string; ms: number | null }> = {
  "24h": { label: "24 h", ms: 24 * HOUR },
  "7d": { label: "7 days", ms: 7 * 24 * HOUR },
  "30d": { label: "30 days", ms: 30 * 24 * HOUR },
  all: { label: "All", ms: null },
};

export const DEFAULT_RANGE = "7d";

export function rangeStart(range: string): Date {
  const ms = (RANGES[range] ?? RANGES[DEFAULT_RANGE]).ms;

  return ms === null ? new Date(0) : new Date(Date.now() - ms);
}
