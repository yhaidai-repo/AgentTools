import { localItem, workItem, type AdoaDb } from "@adoa/db";
import { and, eq, inArray, like } from "drizzle-orm";
import type { Outcome } from "./models/Outcome";
import type { PipelineStatus } from "./models/PipelineStatus";
import { runningRunOn } from "./pbiAdmin";
import { setItemStatus, setPbiStatus } from "./pbiStatus";

// Not prepared yet, already finished, or closed in ADO (user decision 2026-10-05: any prepared PBI can be finished).
const UNFINISHABLE: PipelineStatus[] = ["new", "done", "closed"];

export function isFinishable(status: PipelineStatus): boolean {
  return !UNFINISHABLE.includes(status);
}

// Finishes the PBI in adoa only (ADO untouched). Its open agent tasks are cancelled so no agent works on it again; the
// user's questions, human tasks and findings stay as they are (user decision 2026-10-05).
export async function finishPbi(db: AdoaDb, adoId: number, actor: string): Promise<Outcome<string>> {
  const [pbi] = await db.select({ status: workItem.pipelineStatus }).from(workItem).where(eq(workItem.adoId, adoId));

  if (!pbi) {
    return { ok: false, error: `PBI-${adoId} isn't in adoa.` };
  }

  const problem = await finishProblem(db, adoId, pbi.status);

  if (problem) {
    return { ok: false, error: problem };
  }

  const cancelled = await cancelAgentTasks(db, adoId, actor);

  await setPbiStatus(db, adoId, pbi.status, "done", actor);

  return { ok: true, value: `PBI-${adoId} done${cancelled > 0 ? `; ${cancelled} agent task(s) cancelled` : ""}.` };
}

async function finishProblem(db: AdoaDb, adoId: number, status: PipelineStatus): Promise<string | null> {
  if (!isFinishable(status)) {
    return `PBI-${adoId} is ${status}.`;
  }

  const runId = await runningRunOn(db, adoId);

  return runId === null ? null : `RUN-${runId} is working on PBI-${adoId}; finish it when the run has ended.`;
}

async function cancelAgentTasks(db: AdoaDb, adoId: number, actor: string): Promise<number> {
  const open = await db
    .select({ id: localItem.id, status: localItem.status })
    .from(localItem)
    .where(and(eq(localItem.pbiId, adoId), like(localItem.assignee, "agent:%"), inArray(localItem.status, ["open", "in-progress"])));

  for (const task of open) {
    await setItemStatus(db, task.id, task.status, "cancelled", actor);
  }

  return open.length;
}
