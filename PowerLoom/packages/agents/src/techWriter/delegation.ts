import { setItemStatus } from "@powerloom/core";
import { localItem, type PowerLoomDb } from "@powerloom/db";
import { recordWaiting } from "../tasks/waiting";
import type { TechWriterRun } from "./models/TechWriterRun";

const ACTOR = "agent:tech-writer";

// A run that handed work on with create_task merges nothing (user decision 2026-10-14): the task goes back to open,
// waits for what it created and runs again with the results.
export function isDelegating(run: TechWriterRun): boolean {
  return (run.toolset?.tasks.length ?? 0) > 0;
}

export async function waitForCreatedTasks(db: PowerLoomDb, task: typeof localItem.$inferSelect, runId: number, createdIds: string[]): Promise<void> {
  await recordWaiting(db, task, runId, createdIds);
  await setItemStatus(db, task.id, "in-progress", "open", ACTOR, runId);
}
