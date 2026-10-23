import { budgetDayStart } from "@agenttools/usage";
import { sprintSnapshot, type PowerLoomDb } from "@powerloom/db";
import { eq, sql } from "drizzle-orm";
import { readCurrentSprint } from "./currentSprint";
import type { Period } from "./models/Period";

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const MONDAY_OFFSET = 6;

// One set of periods on every page and every read command (user decision 2026-10-18), remembered per vault in the
// web. "Today" is the daily budgets' day (AgentUsage: from 00:00 UTC); a week starts on Monday 00:00 UTC; the current
// sprint's start needs the vault (see periodStart).
export const PERIODS: Period[] = [
  { key: "1h", label: "1 h", phrase: "the last hour" },
  { key: "today", label: "Today", phrase: "today" },
  { key: "week", label: "This week", phrase: "this week" },
  { key: "sprint", label: "Current sprint", phrase: "this sprint" },
  { key: "30d", label: "30 days", phrase: "the last 30 days" },
];

export const PERIOD_KEYS = ["1h", "today", "week", "sprint", "30d"] as const;

export const DEFAULT_PERIOD = "week";

export const SPRINT_PERIOD = "sprint";

// The period a URL, a cookie or a tool call asks for, or the default for anything else (e.g. a period of the older set).
export function periodOf(value: string | undefined): string {
  return PERIODS.some((period) => period.key === value) ? value! : DEFAULT_PERIOD;
}

// How a sentence names the period: "Spent this week".
export function periodPhrase(range: string): string {
  return PERIODS.find((period) => period.key === range)?.phrase ?? range;
}

// When the period starts for the vault. The current sprint starts on its first daily snapshot: the sync stores only the
// sprint's name, and it snapshots the sprint every day it runs. Without a snapshot yet, the week stands in.
export async function periodStart(db: PowerLoomDb, range: string, vault: string): Promise<Date> {
  const now = new Date();

  if (range !== SPRINT_PERIOD) {
    return fixedPeriodStart(range, now);
  }

  return (await currentSprintStart(db, vault)) ?? weekStart(now);
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

async function currentSprintStart(db: PowerLoomDb, vault: string): Promise<Date | null> {
  const path = await readCurrentSprint(db, vault);

  if (!path) {
    return null;
  }

  const [row] = await db.select({ firstDay: sql<string | null>`min(${sprintSnapshot.takenOn})` }).from(sprintSnapshot).where(eq(sprintSnapshot.iterationPath, path));

  return row?.firstDay ? new Date(`${row.firstDay}T00:00:00Z`) : null;
}
