import { localItem, type AdoaDb } from "@adoa/db";
import { and, eq, inArray } from "drizzle-orm";
import { AGENT_STAGES } from "./agentStages";
import { nextItemId } from "./localItemIds";

type ItemRow = typeof localItem.$inferSelect;

const OPEN = ["open", "in-progress"] as const;

// A task for a pipeline agent on a PBI, unless that agent already has an open one there. Returns its id, or null when
// nothing was created (an open task exists, or the agent has no PBI stage).
export async function ensureAgentTask(db: AdoaDb, agentId: string, adoId: number, createdByRun: number | null): Promise<string | null> {
  const stage = AGENT_STAGES[agentId];

  if (!stage || (await hasOpenTask(db, agentId, adoId))) {
    return null;
  }

  const id = await nextItemId(db, stage.prefix, adoId);

  await db.insert(localItem).values({
    id, kind: stage.kind, pbiId: adoId, title: stage.title, status: "open", assignee: `agent:${agentId}`, createdByRun,
  });

  return id;
}

// After a successful task: the agent's configured next agent gets a task (user decision 2026-10-01). Marked as handed on
// either way, so the worker's loop does this once per task.
export async function handOn(db: AdoaDb, task: ItemRow, nextAgentId: string | null): Promise<string | null> {
  const created = nextAgentId ? await ensureAgentTask(db, nextAgentId, task.pbiId, null) : null;

  await db.update(localItem).set({ handedOnAt: new Date() }).where(eq(localItem.id, task.id));

  return created;
}

async function hasOpenTask(db: AdoaDb, agentId: string, adoId: number): Promise<boolean> {
  const rows = await db
    .select({ id: localItem.id })
    .from(localItem)
    .where(and(eq(localItem.pbiId, adoId), eq(localItem.assignee, `agent:${agentId}`), inArray(localItem.status, [...OPEN])))
    .limit(1);

  return rows.length > 0;
}
