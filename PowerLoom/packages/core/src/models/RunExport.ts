import type { UsageRecord } from "@agenttools/usage";
import type { AgentRunRow } from "./AgentRunRow";
import type { LogEntryRow } from "./LogEntryRow";
import type { RunExportEvent } from "./RunExportEvent";
import type { RunListRow } from "./RunListRow";

/** A run in one file to save and share: the run (its input, outcome, error), its task, usage, whole trace and logs. */
export interface RunExport {
  exportedAt: Date;
  run: AgentRunRow;
  task: RunListRow["task"];
  usage: UsageRecord | null;
  trace: RunExportEvent[];
  logs: LogEntryRow[];
}
