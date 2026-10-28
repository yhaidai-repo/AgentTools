import { handoffContextBlock, loadHandoffContext, type PreviousResult } from "@powerloom/core";
import { runResult, type PowerLoomDb } from "@powerloom/db";
import { desc, eq } from "drizzle-orm";

export async function loadPreviousResult(db: PowerLoomDb, taskId: string): Promise<PreviousResult | null> {
  const [previous] = await db.select({ runId: runResult.runId, status: runResult.status, body: runResult.body })
    .from(runResult).where(eq(runResult.taskId, taskId)).orderBy(desc(runResult.createdAt)).limit(1);

  return previous ?? null;
}

// What the task is handed before its run, as the shared hand-off renderer writes it: the hand-offs that created it, the
// outcomes of the hand-offs it waits for, and its latest result, so a rerun continues instead of starting over (as
// Autotest's previous report did). "Start over" leaves the result out: the run begins fresh, without the last run's
// conversation or its result (user request 2026-10-25).
export async function runContextBlock(db: PowerLoomDb, task: { id: string; data: unknown; startOver: boolean }): Promise<string> {
  const previous = task.startOver ? null : await loadPreviousResult(db, task.id);

  return handoffContextBlock(await loadHandoffContext(db, task, previous));
}
