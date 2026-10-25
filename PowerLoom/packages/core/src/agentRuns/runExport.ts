import type { StoredTraceEvent, UsageStore } from "@agenttools/usage";
import type { PowerLoomDb } from "@powerloom/db";
import { readLogEntriesAbout } from "../logs/logEntries";
import type { LogEntryRow } from "../models/LogEntryRow";
import type { RunExport } from "../models/RunExport";
import type { RunExportEvent } from "../models/RunExportEvent";
import type { RunListRow } from "../models/RunListRow";
import { loadRun, loadRunUsage } from "./runDetail";
import { traceEventName, traceEventSummary } from "./traceEvents";

// What was logged about the run's task from a day before the run: a dispatch that failed first shows there.
const LOGS_BEFORE_MS = 24 * 60 * 60 * 1000;

/** The run of the vault in one file ("Download" on the run page), or null when the vault has no such run. */
export async function loadRunExport(db: PowerLoomDb, usage: UsageStore, runId: number, vault: string): Promise<RunExport | null> {
  const found = await loadRun(db, runId, vault);

  if (!found) {
    return null;
  }

  const since = new Date(found.run.startedAt.getTime() - LOGS_BEFORE_MS);
  const logs = await readLogEntriesAbout(db, { taskId: found.run.itemId, runId }, since);

  return runExportOf(found, await loadRunUsage(usage, runId), await usage.trace(String(runId)), logs, new Date());
}

export function runExportOf(found: Pick<RunListRow, "run" | "task">, usage: RunExport["usage"], trace: StoredTraceEvent[], logs: LogEntryRow[], exportedAt: Date): RunExport {
  return { exportedAt, run: found.run, task: found.task, usage, trace: trace.map(exportEventOf), logs };
}

function exportEventOf(event: StoredTraceEvent): RunExportEvent {
  return { seq: event.seq, at: event.at, type: event.type, name: traceEventName(event), summary: traceEventSummary(event), payload: event.payload };
}
