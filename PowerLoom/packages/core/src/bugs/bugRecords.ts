import { bug, workItem, type PowerLoomDb } from "@powerloom/db";
import { eq } from "drizzle-orm";
import type { BugInfo } from "../models/BugInfo";
import type { NewBug } from "../models/NewBug";

// Bugs are prepared without the user (user decision 2026-10-09): PowerLoom prepares a new or changed one after the
// sync that brought it. PBIs stay manual.

// Records a child work item as a bug of its parent, with the parent's status at that moment. A bug already recorded keeps
// its first record.
export async function recordBug(db: PowerLoomDb, newBug: NewBug): Promise<void> {
  const [parent] = await db.select({ pipelineStatus: workItem.pipelineStatus }).from(workItem).where(eq(workItem.adoId, newBug.pbiId));

  if (!parent) {
    throw new Error(`PBI-${newBug.pbiId} isn't in PowerLoom`);
  }

  await db.insert(bug).values({ ...newBug, foundIn: parent.pipelineStatus }).onConflictDoNothing();
}

export async function readBug(db: PowerLoomDb, workItemId: number): Promise<BugInfo | null> {
  const [row] = await db
    .select({ source: bug.source, foundIn: bug.foundIn, reportedBy: bug.reportedBy, createdAt: bug.createdAt })
    .from(bug)
    .where(eq(bug.workItemId, workItemId));

  return row ?? null;
}
