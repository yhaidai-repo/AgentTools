import { syncPipelineStatus, vaultBacklogRoot, type PipelineStatus } from "@adoa/core";
import { localItem, workItem } from "@adoa/db";
import { publishPbi } from "@adoa/notes";
import { and, eq, isNotNull, isNull, like, or } from "drizzle-orm";
import type { WorkerContext } from "./models/WorkerContext";

// PBIs the pipeline doesn't work on: not prepared yet, or done in ADO.
const INACTIVE: PipelineStatus[] = ["new", "closed"];
const ACTOR = "worker";

// One PBI brought up to date when a queued task references it: the status that follows from all tasks, then the Vault
// showing the result (linked documents, hand-ons and drafts are PowerLoom's).
export async function refreshPbi(context: WorkerContext, adoId: number): Promise<void> {
  const { db } = context;
  const [row] = await db.select().from(workItem).where(eq(workItem.adoId, adoId));

  if (!row || INACTIVE.includes(row.pipelineStatus)) {
    return;
  }

  await syncPipelineStatus(db, adoId, ACTOR);
  await publishPbi(db, vaultBacklogRoot(context.backlogMount, row.vault), adoId);
}

// The task queue drives the worker (user decision 2026-10-01): only PBIs referenced by agent tasks waiting in it
// (all agents' on a tick, one agent's on its dispatch) or finished and not yet handed on to the next agent.
export async function refreshQueuedPbis(context: WorkerContext, agentId?: string): Promise<number> {
  const waiting = agentId ? eq(localItem.assignee, `agent:${agentId}`) : like(localItem.assignee, "agent:%");
  const rows = await context.db
    .selectDistinct({ adoId: localItem.pbiId })
    .from(localItem)
    .where(and(
      isNotNull(localItem.pbiId),
      or(and(waiting, eq(localItem.status, "open")), and(like(localItem.assignee, "agent:%"), eq(localItem.status, "done"), isNull(localItem.handedOnAt))),
    ));

  for (const row of rows) {
    await refreshPbi(context, row.adoId!);
  }

  return rows.length;
}
