import { sprintSnapshot } from "@powerloom/db";
import { desc, eq, sql } from "drizzle-orm";
import type { SprintDay } from "@/models/SprintDay";
import type { SprintSummary } from "@/models/SprintSummary";
import { getDb } from "./db";

// ADO states in the order a sprint item moves through them; states ADO adds later go after, as they come.
export const ADO_STATE_ORDER = ["New", "Approved", "Committed", "To Do", "Ready for Dev", "In Progress", "Active", "Rework Required", "Code Review", "Testing", "Ready for Release", "Resolved", "Done", "Closed"];

// Ready for Release counts as done: the sprint's work is over by then (user decision 2026-10-13).
const DONE_STATES = ["Ready for Release", "Done", "Closed"];

// Each state has its own fixed color, so it looks the same in every sprint (user, 2026-10-16: Code Review took Done's
// green when colors went by position). Green is the done states: Ready for Release, Done and Closed (user, 2026-10-16).
// The usual run New → To Do → Ready for Dev → In Progress → Rework Required → Code Review → Testing → done passes the
// palette's adjacent colorblind and contrast checks in both modes. A state ADO adds later is "Other".
const STATE_SLOTS: Record<string, number> = {
  New: 1,
  Approved: 12,
  Committed: 10,
  "To Do": 2,
  "Ready for Dev": 3,
  "In Progress": 11,
  Active: 9,
  "Rework Required": 4,
  "Code Review": 5,
  Testing: 7,
  "Ready for Release": 6,
  Resolved: 8,
  Done: 6,
  Closed: 6,
};

export const OTHER_STATE_COLOR = "var(--muted)";

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

export function hasStateColor(state: string): boolean {
  return state in STATE_SLOTS;
}

export function stateColor(state: string): string {
  return hasStateColor(state) ? `var(--series-${STATE_SLOTS[state]})` : OTHER_STATE_COLOR;
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
