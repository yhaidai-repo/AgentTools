import type { PipelineStatus } from "@powerloom/core";
import { agentRun, localItem, statusHistory } from "@powerloom/db";
import { and, asc, count, eq, like } from "drizzle-orm";
import type { MetroStation } from "@/models/MetroStation";
import type { StageTask } from "@/models/StageTask";
import { getDb } from "./db";

// The metro line's stations and the statuses each covers. Waiting on you, stale and closed aren't stations: the PBI
// stays at the station it was at, and the page tells why.
const STATIONS: { key: string; name: string; statuses: PipelineStatus[] }[] = [
  { key: "new", name: "New", statuses: ["new"] },
  { key: "refinement", name: "Refinement", statuses: ["ready-for-refinement", "refining"] },
  { key: "research", name: "Research", statuses: ["needs-research", "researching"] },
  { key: "design", name: "Planning", statuses: ["ready-for-design", "designing"] },
  { key: "ready", name: "Ready for dev", statuses: ["ready-for-dev"] },
  { key: "development", name: "Development", statuses: ["development"] },
  { key: "test", name: "Test", statuses: ["ready-for-test", "testing", "tested", "test-failed"] },
  { key: "done", name: "Done", statuses: ["done"] },
];

// A finished task of these kinds passes its station even when the PBI's status never went there (user decision
// 2026-10-21): e.g. a design task created as non-blocking, or tests that ran before the test stage existed.
const STATION_TASK_KINDS: Record<string, string[]> = { refinement: ["refinement"], research: ["research"], design: ["design"], test: ["test"] };

interface Stay {
  status: string;
  hours: number;
}

// The PBI's stations: where it has been and for how long (from its status history), what its agent tasks did there,
// where it is now.
export async function loadMetroLine(adoId: number, current: PipelineStatus): Promise<MetroStation[]> {
  const [stays, tasks] = await Promise.all([loadStays(adoId), loadStageTasks(adoId)]);
  const here = currentStation(current, stays);

  return skipPassedOver(STATIONS.map((station, index) => toStation(station, index, here, stays, tasks)));
}

// A station ahead of the current one that a later passed station went past (e.g. development, when tests already ran)
// was skipped, not still ahead.
function skipPassedOver(stations: MetroStation[]): MetroStation[] {
  const lastPassed = stations.findLastIndex((station) => station.state === "passed");

  return stations.map((station, index) => (station.state === "ahead" && index < lastPassed ? { ...station, state: "skipped" } : station));
}

function toStation(station: (typeof STATIONS)[number], index: number, here: number, stays: Stay[], tasks: StageTask[]): MetroStation {
  const hours = hoursAt(station.statuses, stays);
  const own = tasks.filter((task) => (STATION_TASK_KINDS[station.key] ?? []).includes(task.kind));
  const isWorkDone = own.some((task) => task.isDone);

  return { key: station.key, name: station.name, state: stateOf(index, here, hours, isWorkDone), hours, runs: own.reduce((sum, task) => sum + task.runs, 0) };
}

// The PBI's agent tasks with their runs.
async function loadStageTasks(adoId: number): Promise<StageTask[]> {
  const rows = await getDb()
    .select({ kind: localItem.kind, status: localItem.status, runs: count(agentRun.id) })
    .from(localItem)
    .leftJoin(agentRun, eq(agentRun.itemId, localItem.id))
    .where(and(eq(localItem.pbiId, adoId), like(localItem.assignee, "agent:%")))
    .groupBy(localItem.id);

  return rows.map((row) => ({ kind: row.kind, isDone: row.status === "done", runs: row.runs }));
}

// Each status the PBI left, with how long it stayed; the stay at the current status runs until now.
async function loadStays(adoId: number): Promise<Stay[]> {
  const rows = await getDb()
    .select({ toStatus: statusHistory.toStatus, at: statusHistory.at })
    .from(statusHistory)
    .where(and(eq(statusHistory.entityKind, "pbi"), eq(statusHistory.entityId, String(adoId))))
    .orderBy(asc(statusHistory.at), asc(statusHistory.id));

  return rows.map((row, index) => ({ status: row.toStatus, hours: hoursBetween(new Date(row.at), rows[index + 1] ? new Date(rows[index + 1].at) : new Date()) }));
}

// The station of the current status; a pause (waiting on you, stale, closed) stays at the last real station.
function currentStation(current: PipelineStatus, stays: Stay[]): number {
  const own = stationIndex(current);

  if (own >= 0) {
    return own;
  }

  const lastReal = [...stays].reverse().map((stay) => stationIndex(stay.status)).find((index) => index >= 0);

  return lastReal ?? 0;
}

// Every PBI starts at New, so New counts as passed even without a history entry for it.
function stateOf(index: number, here: number, hours: number | null, isWorkDone: boolean): MetroStation["state"] {
  if (index === here) {
    return "current";
  }

  if (isWorkDone) {
    return "passed";
  }

  if (index > here) {
    return "ahead";
  }

  return hours === null && index > 0 ? "skipped" : "passed";
}

function stationIndex(status: string): number {
  return STATIONS.findIndex((station) => (station.statuses as string[]).includes(status));
}

function hoursAt(statuses: PipelineStatus[], stays: Stay[]): number | null {
  const own = stays.filter((stay) => (statuses as string[]).includes(stay.status));

  return own.length === 0 ? null : own.reduce((sum, stay) => sum + stay.hours, 0);
}

function hoursBetween(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 3_600_000;
}
