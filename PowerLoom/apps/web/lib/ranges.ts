import { budgetDayStart } from "@agenttools/usage";
import type { Period } from "@/models/Period";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const MONDAY_OFFSET = 6;

// One set of periods on every page (user decision 2026-10-18), remembered per vault. "Today" is the daily budgets' day
// (AgentUsage: from 00:00 UTC); a week starts on Monday 00:00 UTC; the current sprint's start needs the vault (see
// periodStart).
export const PERIODS: Period[] = [
  { key: "1h", label: "1 h", phrase: "the last hour" },
  { key: "today", label: "Today", phrase: "today" },
  { key: "week", label: "This week", phrase: "this week" },
  { key: "sprint", label: "Current sprint", phrase: "this sprint" },
  { key: "30d", label: "30 days", phrase: "the last 30 days" },
];

export const DEFAULT_RANGE = "week";

export const SPRINT_RANGE = "sprint";

// The period a URL or cookie asks for, or the default for anything else (e.g. a period of the older set).
export function periodOf(value: string | undefined): string {
  return PERIODS.some((period) => period.key === value) ? value! : DEFAULT_RANGE;
}

// How a sentence names the period: "Spent this week".
export function periodPhrase(range: string): string {
  return PERIODS.find((period) => period.key === range)?.phrase ?? range;
}

// For the period switch (functions can't cross to the browser).
export function rangeOptions(): { key: string; label: string }[] {
  return PERIODS.map(({ key, label }) => ({ key, label }));
}

// Every period's start but the current sprint's, which is read from the vault's sprint snapshots.
export function fixedPeriodStart(range: string, now: Date): Date {
  switch (range) {
    case "1h":
      return new Date(now.getTime() - HOUR);
    case "today":
      return budgetDayStart(now);
    case "30d":
      return new Date(now.getTime() - 30 * DAY);
    default:
      return weekStart(now);
  }
}

export function weekStart(now: Date): Date {
  const daysSinceMonday = (now.getUTCDay() + MONDAY_OFFSET) % 7;

  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - daysSinceMonday));
}
