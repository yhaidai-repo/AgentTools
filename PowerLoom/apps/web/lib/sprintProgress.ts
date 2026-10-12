import { sprintSnapshot } from "@powerloom/db";
import { desc, eq, sql } from "drizzle-orm";
import type { SprintDay } from "@/models/SprintDay";
import type { SprintSummary } from "@/models/SprintSummary";
import { getDb } from "./db";

// ADO states in the order a sprint item moves through them; states ADO adds later go after, as they come.
export const ADO_STATE_ORDER = ["New", "Approved", "Committed", "To Do", "Ready for Dev", "In Progress", "Active", "Rework Required", "Code Review", "Ready for Release", "Resolved", "Done", "Closed"];

const DONE_STATES = ["Done", "Closed"];

interface StateCount {
  day: string;
  state: string;
  items: number;
  effort: string | null;
  remainingWork: string | null;
}

// Every sprint with snapshots, newest first.
export async function loadSprintSummaries(): Promise<SprintSummary[]> {
  const rows = await getDb()
    .select({
      iterationPath: sprintSnapshot.iterationPath,
      firstDay: sql<string>`min(${sprintSnapshot.takenOn})`,
      lastDay: sql<string>`max(${sprintSnapshot.takenOn})`,
      days: sql<number>`count(distinct ${sprintSnapshot.takenOn})::int`,
    })
    .from(sprintSnapshot)
    .groupBy(sprintSnapshot.iterationPath)
    .orderBy(desc(sql`max(${sprintSnapshot.takenOn})`));

  return Promise.all(rows.map((row) => summaryOf(row)));
}

// The sprint's snapshot days, oldest first.
export async function loadSprintDays(iterationPath: string): Promise<SprintDay[]> {
  const days = new Map<string, SprintDay>();

  for (const row of await stateCounts(iterationPath)) {
    const day = days.get(row.day) ?? { day: row.day, itemsByState: {}, effort: null, remainingWork: null };

    day.itemsByState[row.state] = row.items;
    day.effort = addNullable(day.effort, row.effort);
    day.remainingWork = addNullable(day.remainingWork, row.remainingWork);
    days.set(row.day, day);
  }

  return [...days.values()].sort((a, b) => a.day.localeCompare(b.day));
}

// The states of a sprint's days in pipeline order, so the series (and their colors) are fixed across sprints.
export function sprintStates(days: SprintDay[]): string[] {
  const seen = new Set(days.flatMap((day) => Object.keys(day.itemsByState)));
  const known = ADO_STATE_ORDER.filter((state) => seen.has(state));
  const unknown = [...seen].filter((state) => !ADO_STATE_ORDER.includes(state)).sort();

  return [...known, ...unknown];
}

export function isDoneState(state: string): boolean {
  return DONE_STATES.includes(state);
}

export function itemsOn(day: SprintDay): number {
  return Object.values(day.itemsByState).reduce((sum, count) => sum + count, 0);
}

export function doneOn(day: SprintDay): number {
  return Object.entries(day.itemsByState).filter(([state]) => isDoneState(state)).reduce((sum, [, count]) => sum + count, 0);
}

async function summaryOf(row: { iterationPath: string; firstDay: string; lastDay: string; days: number }): Promise<SprintSummary> {
  const lastDay = (await loadSprintDays(row.iterationPath)).at(-1);

  return {
    ...row,
    items: lastDay ? itemsOn(lastDay) : 0,
    done: lastDay ? doneOn(lastDay) : 0,
    effort: lastDay?.effort ?? null,
  };
}

function stateCounts(iterationPath: string): Promise<StateCount[]> {
  return getDb()
    .select({
      day: sql<string>`${sprintSnapshot.takenOn}::text`,
      state: sprintSnapshot.adoState,
      items: sql<number>`count(*)::int`,
      effort: sql<string | null>`sum(${sprintSnapshot.effort})::text`,
      remainingWork: sql<string | null>`sum(${sprintSnapshot.remainingWork})::text`,
    })
    .from(sprintSnapshot)
    .where(eq(sprintSnapshot.iterationPath, iterationPath))
    .groupBy(sprintSnapshot.takenOn, sprintSnapshot.adoState);
}

// A sum stays null until a value exists: "no effort in ADO" differs from zero.
function addNullable(total: number | null, value: string | null): number | null {
  if (value === null) {
    return total;
  }

  return (total ?? 0) + Number(value);
}
