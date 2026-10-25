import { runResult, type PowerLoomDb } from "@powerloom/db";
import { desc, eq } from "drizzle-orm";
import type { PreviousResult } from "./models/PreviousResult";

export async function loadPreviousResult(db: PowerLoomDb, taskId: string): Promise<PreviousResult | null> {
  const [previous] = await db.select({ runId: runResult.runId, status: runResult.status, body: runResult.body })
    .from(runResult).where(eq(runResult.taskId, taskId)).orderBy(desc(runResult.createdAt)).limit(1);

  return previous ?? null;
}

// The task's latest result, so a rerun continues instead of starting over (as Autotest's previous report did). "Start
// over" leaves it out: the run begins fresh, without the last run's conversation or its result (user request 2026-10-25).
export function previousResultBlock(previous: PreviousResult | null, startOver: boolean): string {
  if (!previous || startOver) {
    return "";
  }

  const run = previous.runId === null ? "an earlier run" : `RUN-${previous.runId}`;

  return [`<previous-result run="${run}" status="${previous.status}">`, previous.body, "</previous-result>", "Continue from it: don't redo what it settled; write the whole result again as this run's."].join("\n");
}
