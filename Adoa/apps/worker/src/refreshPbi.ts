import { handOn, syncPipelineStatus, vaultBacklogRoot, type PipelineStatus } from "@adoa/core";
import { localItem, workItem } from "@adoa/db";
import { publishPbi } from "@adoa/notes";
import { and, eq, isNotNull, isNull, like, or } from "drizzle-orm";
import { createAdoClient } from "./adoClient";
import { collectLinkedDocuments } from "./documents/collectLinkedDocuments";
import type { WorkerContext } from "./models/WorkerContext";

type ItemRow = typeof localItem.$inferSelect;

// PBIs the pipeline doesn't work on: not prepared yet, or done in ADO.
const INACTIVE: PipelineStatus[] = ["new", "closed"];
const ACTOR = "worker";

// One PBI brought up to date when a queued task references it (merged drafts are the drafts job's). The order matters:
// linked documents and next tasks first, then the status that follows from all tasks, then the Vault showing the result.
export async function refreshPbi(context: WorkerContext, adoId: number): Promise<void> {
  const { db } = context;
  const [row] = await db.select().from(workItem).where(eq(workItem.adoId, adoId));

  if (!row || INACTIVE.includes(row.pipelineStatus)) {
    return;
  }

  await collectLinkedDocuments(context, await createAdoClient(db, row.vault), row);
  await handOnFinishedTasks(context, adoId);
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

// Each successful agent task once: its agent's configured `next` agent gets a task (user decision 2026-10-01).
async function handOnFinishedTasks(context: WorkerContext, adoId: number): Promise<void> {
  const finished = await context.db
    .select()
    .from(localItem)
    .where(and(eq(localItem.pbiId, adoId), like(localItem.assignee, "agent:%"), eq(localItem.status, "done"), isNull(localItem.handedOnAt)));

  for (const task of finished) {
    await handOnTask(context, task);
  }
}

async function handOnTask(context: WorkerContext, task: ItemRow): Promise<void> {
  const agent = await context.config.get(task.assignee.replace("agent:", ""));
  const created = await handOn(context.db, task, agent?.next ?? null);

  if (created) {
    console.log(`${task.id} done: next task ${created} for ${agent?.next}`);
  }
}
