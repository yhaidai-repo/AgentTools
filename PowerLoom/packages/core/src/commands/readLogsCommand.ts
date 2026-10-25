import { z } from "zod";
import { readLogEntries } from "../logs/logEntries";
import { logEntryView } from "../logs/logEntryView";
import type { Command } from "../models/Command";
import type { LogEntryView } from "../models/LogEntryView";
import { limitInput } from "./inputs";

const HOUR_MS = 60 * 60 * 1000;

const input = z.object({
  hours: z.number().int().min(1).max(336).default(24).describe("How far back, in hours (up to 14 days, the log's retention)"),
  service: z.enum(["backend", "runner", "mcp"]).optional().describe("Only one service's: backend (the .NET API, dispatch, syncs), runner (agent runs), mcp (chats)"),
  level: z.enum(["warn", "error"]).optional(),
  run: z.number().int().positive().optional().describe("Only what was logged about this run, e.g. 2716 for RUN-2716"),
  task: z.string().trim().min(1).optional().describe("Only what was logged about this task, e.g. AT-38519-002"),
  search: z.string().trim().min(1).optional().describe("Only entries whose text contains this"),
  limit: limitInput(200, 50),
});

type ReadLogsInput = z.infer<typeof input>;

// The error log (user decision 2026-10-25): what PowerLoom's services logged as a warning or an error, for finding out why
// something failed when the run's trace (run_events) doesn't say: a task that failed before its run started, a dispatch
// that went wrong, a sync or a chat tool that broke. Grafana isn't needed.
export const readLogsCommand: Command<ReadLogsInput, LogEntryView[]> = {
  name: "logs.read",
  effect: "read",
  description: "Read the warnings and errors PowerLoom's services logged (backend, runner, mcp), newest first: why a task failed before its run started, a dispatch, sync or chat tool that broke. Repeats are one entry with a count. Filter by hours back, service, level, run, task or text. For a run's own steps read run_events first.",
  input,
  async run(context, input) {
    const rows = await readLogEntries(context.db, {
      since: new Date(Date.now() - input.hours * HOUR_MS),
      service: input.service,
      level: input.level,
      runId: input.run,
      taskId: input.task,
      search: input.search,
      limit: input.limit,
    });

    return { ok: true, value: rows.map(logEntryView) };
  },
};
