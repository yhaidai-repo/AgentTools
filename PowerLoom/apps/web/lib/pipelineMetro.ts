import type { PipelineStatus } from "@powerloom/core";
import { statusHistory } from "@powerloom/db";
import { and, asc, eq } from "drizzle-orm";
import type { MetroStation } from "@/models/MetroStation";
import { getDb } from "./db";

// The metro line's stations and the statuses each covers. Waiting on you, stale and closed aren't stations: the PBI
// stays at the station it was at, and the page tells why.
const STATIONS: { key: string; name: string; statuses: PipelineStatus[] }[] = [
  { key: "new", name: "New", statuses: ["new"] },
  { key: "refinement", name: "Refinement", statuses: ["ready-for-refinement", "refining"] },
  { key: "research", name: "Research", statuses: ["needs-research", "researching"] },
  { key: "design", name: "Design", statuses: ["ready-for-design", "designing"] },
  { key: "ready", name: "Ready for dev", statuses: ["ready-for-dev"] },
  { key: "development", name: "Development", statuses: ["development"] },
  { key: "done", name: "Done", statuses: ["done"] },
];

interface Stay {
  status: string;
  hours: number;
}

// The PBI's stations: where it has been and for how long (from its status history), where it is now.
export async function loadMetroLine(adoId: number, current: PipelineStatus): Promise<MetroStation[]> {
  const stays = await loadStays(adoId);
  const here = currentStation(current, stays);

  return STATIONS.map((station, index) => ({ key: station.key, name: station.name, state: stateOf(index, here, hoursAt(station.statuses, stays)), hours: hoursAt(station.statuses, stays) }));
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
function stateOf(index: number, here: number, hours: number | null): MetroStation["state"] {
  if (index === here) {
    return "current";
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
