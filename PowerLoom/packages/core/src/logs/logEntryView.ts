import { runRef } from "../agentRuns/vaultRuns";
import type { LogEntryRow } from "../models/LogEntryRow";
import type { LogEntryView } from "../models/LogEntryView";

export function logEntryView(row: LogEntryRow): LogEntryView {
  return {
    service: row.service,
    level: row.level,
    count: row.count,
    firstAt: row.firstAt,
    lastAt: row.lastAt,
    message: row.message,
    run: row.runId === null ? null : runRef(row.runId),
    taskId: row.taskId,
    pbiId: row.pbiId,
    vault: row.vault,
  };
}
