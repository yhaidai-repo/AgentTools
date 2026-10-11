import { bug, pbiRepo, workItem, type PowerLoomDb } from "@powerloom/db";
import { and, asc, eq, sql } from "drizzle-orm";
import type { ChildItem } from "../models/ChildItem";
import type { ParentPbi } from "../models/ParentPbi";

// The PBI an item is filed under: the item itself, or its parent when it is a child. Children stay one level deep
// (user decision 2026-10-09), so a child of a child goes to the top PBI. Null when PowerLoom doesn't have the item.
export async function topLevelPbi(db: PowerLoomDb, adoId: number): Promise<ParentPbi | null> {
  const row = await readParentPbi(db, adoId);

  if (!row?.parentId) {
    return row;
  }

  return readParentPbi(db, row.parentId);
}

// A new child starts from its parent's context (user decision 2026-10-09): the parent's skills and repos, so its
// agents work where the parent's design works.
export async function inheritParentContext(db: PowerLoomDb, childId: number, parentId: number): Promise<void> {
  const [parent] = await db.select({ skills: workItem.skills }).from(workItem).where(eq(workItem.adoId, parentId));
  const repos = await db.select({ repoId: pbiRepo.repoId, source: pbiRepo.source }).from(pbiRepo).where(eq(pbiRepo.pbiId, parentId));
  const hasNoSkills = sql`jsonb_array_length(${workItem.skills}) = 0`;

  await db.update(workItem).set({ skills: parent?.skills ?? [] }).where(and(eq(workItem.adoId, childId), hasNoSkills));

  if (repos.length === 0) {
    return;
  }

  await db.insert(pbiRepo).values(repos.map((row) => ({ pbiId: childId, repoId: row.repoId, source: row.source }))).onConflictDoNothing();
}

// The PBI's child items with their bug source (null for a child that isn't a bug).
export async function readChildItems(db: PowerLoomDb, parentId: number): Promise<ChildItem[]> {
  return db
    .select({
      adoId: workItem.adoId,
      title: workItem.title,
      type: workItem.type,
      source: workItem.source,
      adoState: workItem.adoState,
      pipelineStatus: workItem.pipelineStatus,
      bugSource: bug.source,
    })
    .from(workItem)
    .leftJoin(bug, eq(bug.workItemId, workItem.adoId))
    .where(eq(workItem.parentId, parentId))
    .orderBy(asc(workItem.adoId));
}

export async function childIds(db: PowerLoomDb, parentId: number): Promise<number[]> {
  const rows = await db.select({ adoId: workItem.adoId }).from(workItem).where(eq(workItem.parentId, parentId));

  return rows.map((row) => row.adoId);
}

async function readParentPbi(db: PowerLoomDb, adoId: number): Promise<(ParentPbi & { parentId: number | null }) | null> {
  const [row] = await db
    .select({ adoId: workItem.adoId, title: workItem.title, vault: workItem.vault, pipelineStatus: workItem.pipelineStatus, parentId: workItem.parentId })
    .from(workItem)
    .where(eq(workItem.adoId, adoId));

  return row ?? null;
}
