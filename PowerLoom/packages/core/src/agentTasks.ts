import { localItem, type PowerLoomDb } from "@powerloom/db";
import { and, eq, inArray } from "drizzle-orm";
import { AGENT_STAGES } from "./agentStages";
import { nextItemId } from "./localItemIds";
import { vaultOfPbiSql } from "./vaults";

type ItemRow = typeof localItem.$inferSelect;

const OPEN = ["open", "in-progress"] as const;

// A task for a pipeline agent on a PBI, unless that agent already has an open one there. Returns its id, or null when
// nothing was created (an open task exists, or the agent has no PBI stage).
export async function ensureAgentTask(db: PowerLoomDb, agentId: string, adoId: number, createdByRun: number | null): Promise<string | null> {
  const stage = AGENT_STAGES[agentId];

  if (!stage || (await hasOpenTask(db, agentId, adoId))) {
    return null;
  }

  const id = await nextItemId(db, stage.prefix, adoId);

  await db.insert(localItem).values({
    id, kind: stage.kind, pbiId: adoId, vault: vaultOfPbiSql(adoId), title: stage.title, status: "open", assignee: `agent:${agentId}`, createdByRun,
  });

  return id;
}

async function hasOpenTask(db: PowerLoomDb, agentId: string, adoId: number): Promise<boolean> {
  const rows = await db
    .select({ id: localItem.id })
    .from(localItem)
    .where(and(eq(localItem.pbiId, adoId), eq(localItem.assignee, `agent:${agentId}`), inArray(localItem.status, [...OPEN])))
    .limit(1);

  return rows.length > 0;
}

// Pipeline stages (refinement, research, design) always work on a PBI; a task of theirs without one is a bug.
export function requirePbiId(task: ItemRow): number {
  if (task.pbiId === null) {
    throw new Error(`${task.id} has no PBI, but ${task.assignee} works only on PBIs`);
  }

  return task.pbiId;
}
