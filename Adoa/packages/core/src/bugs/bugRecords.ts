import { bug, workItem, type AdoaDb } from "@adoa/db";
import { eq, inArray } from "drizzle-orm";
import type { BugInfo } from "../models/BugInfo";
import type { BugToPrepare } from "../models/BugToPrepare";
import type { NewBug } from "../models/NewBug";
import type { PipelineStatus } from "../models/PipelineStatus";

// Bugs are prepared without the user (user decision 2026-10-09): a new one, or one whose content changed, gets its
// refinement task on the next dispatcher tick. PBIs stay manual.
const NEEDS_PREPARE: PipelineStatus[] = ["new", "stale"];

// Records a child work item as a bug of its parent, with the parent's status at that moment. A bug already recorded keeps
// its first record.
export async function recordBug(db: AdoaDb, newBug: NewBug): Promise<void> {
  const [parent] = await db.select({ pipelineStatus: workItem.pipelineStatus }).from(workItem).where(eq(workItem.adoId, newBug.pbiId));

  if (!parent) {
    throw new Error(`PBI-${newBug.pbiId} isn't in adoa`);
  }

  await db.insert(bug).values({ ...newBug, foundIn: parent.pipelineStatus }).onConflictDoNothing();
}

export async function readBug(db: AdoaDb, workItemId: number): Promise<BugInfo | null> {
  const [row] = await db
    .select({ source: bug.source, foundIn: bug.foundIn, reportedBy: bug.reportedBy, createdAt: bug.createdAt })
    .from(bug)
    .where(eq(bug.workItemId, workItemId));

  return row ?? null;
}

export async function bugsToPrepare(db: AdoaDb): Promise<BugToPrepare[]> {
  return db
    .select({ adoId: workItem.adoId, vault: workItem.vault })
    .from(bug)
    .innerJoin(workItem, eq(workItem.adoId, bug.workItemId))
    .where(inArray(workItem.pipelineStatus, NEEDS_PREPARE));
}
