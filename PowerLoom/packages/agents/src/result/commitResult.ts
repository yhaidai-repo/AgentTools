import { runResult, type PowerLoomDb } from "@powerloom/db";
import type { ResultDraft } from "./models/ResultDraft";

export interface ResultTarget {
  runId: number;
  taskId: string;
  pbiId: number | null;
  agent: string;
}

// Writes the run's result, when it recorded one, as a new row: a task's earlier results stay as its history.
// Returns the run output line that names it.
export async function commitResult(db: PowerLoomDb, target: ResultTarget, result: ResultDraft | null): Promise<string | null> {
  if (!result) {
    return null;
  }

  await db.insert(runResult).values({
    runId: target.runId,
    taskId: target.taskId,
    pbiId: target.pbiId,
    agent: target.agent,
    status: result.status,
    body: result.body,
    data: result.data,
    evidence: result.evidence.length > 0 ? result.evidence : null,
  });

  return `result: ${result.status}`;
}
