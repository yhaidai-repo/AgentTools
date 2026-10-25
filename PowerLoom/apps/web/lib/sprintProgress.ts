import { sprintSnapshot, workItem } from "@powerloom/db";
import { and, desc, eq, sql } from "drizzle-orm";
import type { SprintDay } from "@/models/SprintDay";
import type { SprintSummary } from "@/models/SprintSummary";
import { getDb } from "./db";

// Neighbouring states that mean the same for a sprint are one series of its chart (user decisions 2026-10-21 and
// 2026-10-22): To Do and Ready for Dev (not started), Ready for Release and Done (the sprint's work is over).
const TODO_OR_READY = "To Do / Ready for Dev";
const RELEASE_OR_DONE = "Ready for release / Done";
const MERGED_STATES: Record<string, string> = { "To Do": TODO_OR_READY, "Ready for Dev": TODO_OR_READY, "Ready for Release": RELEASE_OR_DONE, Done: RELEASE_OR_DONE };

// ADO states in the order a sprint item moves through them; states ADO adds later go after, as they come.
export const ADO_STATE_ORDER = ["New", "Approved", "Committed", "To Do", "Ready for Dev", TODO_OR_READY, "In Progress", "Active", "Rework Required", "Code Review", "Testing", "Ready for Release", RELEASE_OR_DONE, "Resolved", "Done", "Closed"];

// Ready for Release counts as done: the sprint's work is over by then (user decision 2026-10-13).
const DONE_STATES = ["Ready for Release", RELEASE_OR_DONE, "Done", "Closed"];

// Each state has its own fixed color, so it looks the same in every sprint (user, 2026-10-16: Code Review took Done's
// green when colors went by position). The done states share the OK colour: Ready for Release, Resolved, Done and
// Closed (user, 2026-10-16 and 2026-10-18). A state ADO adds later is "Other".
const STATE_COLORS: Record<string, string> = {
  New: "var(--state-new)",
  Approved: "var(--state-todo)",
  Committed: "var(--state-todo)",
  "To Do": "var(--state-todo)",
  "Ready for Dev": "var(--state-ready)",
  [TODO_OR_READY]: "var(--state-ready)",
  "In Progress": "var(--state-progress)",
  Active: "var(--state-progress)",
  "Rework Required": "var(--state-rework)",
  "Code Review": "var(--state-review)",
  Testing: "var(--state-testing)",
  "Ready for Release": "var(--state-done)",
  [RELEASE_OR_DONE]: "var(--state-done)",
  Resolved: "var(--state-done)",
  Done: "var(--state-done)",
  Closed: "var(--state-done)",
};

export const OTHER_STATE_COLOR = "var(--muted)";

interface StateCount {
  day: string;
  state: string;
  items: number;
  effort: string | null;
}

// Every sprint with snapshots of the vault's PBIs, newest first.
export async function loadSprintSummaries(vault: string): Promise<SprintSummary[]> {
  const rows = await getDb()
    .select({
      iterationPath: sprintSnapshot.iterationPath,
      firstDay: sql<string>`min(${sprintSnapshot.takenOn})`,
      lastDay: sql<string>`max(${sprintSnapshot.takenOn})`,
      days: sql<number>`count(distinct ${sprintSnapshot.takenOn})::int`,
    })
    .from(sprintSnapshot)
    .innerJoin(workItem, eq(workItem.adoId, sprintSnapshot.adoId))
    .where(eq(workItem.vault, vault))
    .groupBy(sprintSnapshot.iterationPath)
    .orderBy(desc(sql`max(${sprintSnapshot.takenOn})`));

  return Promise.all(rows.map((row) => summaryOf(row, vault)));
}

// The sprint's snapshot days of the vault's PBIs, oldest first.
export async function loadSprintDays(iterationPath: string, vault: string): Promise<SprintDay[]> {
  const days = new Map<string, SprintDay>();

  for (const row of await stateCounts(iterationPath, vault)) {
    days.set(row.day, addStateCount(days.get(row.day) ?? { day: row.day, itemsByState: {}, effortByState: {}, effort: null }, row));
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
  return state in STATE_COLORS;
}

export function stateColor(state: string): string {
  return STATE_COLORS[state] ?? OTHER_STATE_COLOR;
}

// The last segment of the iteration path: ZZ6.4.1 → 26.4.1.
export function sprintName(iterationPath: string): string {
  return iterationPath.split("\\").at(-1) ?? iterationPath;
}

export function itemsOn(day: SprintDay): number {
  return Object.values(day.itemsByState).reduce((sum, count) => sum + count, 0);
}

export function doneOn(day: SprintDay): number {
  return sumDone(day.itemsByState);
}

// Null when no item carries effort, like the day's total.
export function doneEffortOn(day: SprintDay): number | null {
  return day.effort === null ? null : sumDone(day.effortByState);
}

function sumDone(byState: Record<string, number>): number {
  return Object.entries(byState).filter(([state]) => isDoneState(state)).reduce((sum, [, value]) => sum + value, 0);
}

// Merged states add up into their one series.
function addStateCount(day: SprintDay, row: StateCount): SprintDay {
  const state = MERGED_STATES[row.state] ?? row.state;

  day.itemsByState[state] = (day.itemsByState[state] ?? 0) + row.items;
  day.effort = addNullable(day.effort, row.effort);

  if (row.effort !== null) {
    day.effortByState[state] = (day.effortByState[state] ?? 0) + Number(row.effort);
  }

  return day;
}

async function summaryOf(row: { iterationPath: string; firstDay: string; lastDay: string; days: number }, vault: string): Promise<SprintSummary> {
  const lastDay = (await loadSprintDays(row.iterationPath, vault)).at(-1);

  return {
    ...row,
    items: lastDay ? itemsOn(lastDay) : 0,
    done: lastDay ? doneOn(lastDay) : 0,
    effort: lastDay?.effort ?? null,
    doneEffort: lastDay ? doneEffortOn(lastDay) : null,
  };
}

function stateCounts(iterationPath: string, vault: string): Promise<StateCount[]> {
  return getDb()
    .select({
      day: sql<string>`${sprintSnapshot.takenOn}::text`,
      state: sprintSnapshot.adoState,
      items: sql<number>`count(*)::int`,
      effort: sql<string | null>`sum(${sprintSnapshot.effort})::text`,
    })
    .from(sprintSnapshot)
    .innerJoin(workItem, eq(workItem.adoId, sprintSnapshot.adoId))
    .where(and(eq(sprintSnapshot.iterationPath, iterationPath), eq(workItem.vault, vault)))
    .groupBy(sprintSnapshot.takenOn, sprintSnapshot.adoState);
}

// A sum stays null until a value exists: "no effort in ADO" differs from zero.
function addNullable(total: number | null, value: string | null): number | null {
  if (value === null) {
    return total;
  }

  return (total ?? 0) + Number(value);
}
