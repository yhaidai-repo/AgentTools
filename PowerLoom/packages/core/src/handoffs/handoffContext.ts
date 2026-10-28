import { handoff, localItem, type PowerLoomDb } from "@powerloom/db";
import { asc, eq, inArray } from "drizzle-orm";
import type { HandoffContext } from "../models/HandoffContext";
import type { HandoffView } from "../models/HandoffView";
import type { PreviousResult } from "../models/PreviousResult";

// The ids a task waits for (`data.dependsOn`, chaining v2), which the dispatcher checks before starting it.
export function dependsOnOf(data: unknown): string[] {
  const dependsOn = (data as { dependsOn?: unknown } | null)?.dependsOn;

  return Array.isArray(dependsOn) ? dependsOn.filter((id): id is string => typeof id === "string") : [];
}

/** The hand-offs into the task and into what it depends on, beside its previous result. */
export async function loadHandoffContext(db: PowerLoomDb, task: { id: string; data: unknown }, previous: PreviousResult | null): Promise<HandoffContext> {
  const dependsOn = dependsOnOf(task.data);
  const handoffs = await loadHandoffsInto(db, [task.id, ...dependsOn]);

  return {
    incoming: handoffs.filter((view) => view.toItemId === task.id),
    dependencies: handoffs.filter((view) => dependsOn.includes(view.toItemId)),
    previous,
  };
}

/** Every hand-off whose target is one of the items, with the target's status and answer, oldest first. */
export async function loadHandoffsInto(db: PowerLoomDb, itemIds: string[]): Promise<HandoffView[]> {
  if (itemIds.length === 0) {
    return [];
  }

  const rows = await db.select({ handoff, targetStatus: localItem.status, targetResolution: localItem.resolution })
    .from(handoff).innerJoin(localItem, eq(localItem.id, handoff.toItemId))
    .where(inArray(handoff.toItemId, itemIds)).orderBy(asc(handoff.createdAt), asc(handoff.id));

  return rows.map(({ handoff: row, targetStatus, targetResolution }) => ({
    id: row.id,
    from: { taskId: row.fromTaskId, agent: row.fromAgent, runId: row.fromRunId },
    toKind: row.toKind,
    toItemId: row.toItemId,
    intent: row.intent,
    gate: row.gate,
    package: { body: row.body, refs: row.refs },
    status: row.status,
    createdAt: row.createdAt,
    closedAt: row.closedAt,
    targetStatus,
    targetResolution,
  }));
}
