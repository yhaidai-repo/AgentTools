import { inheritParentContext, isMarkedBug, recordBug, setPbiStatus } from "@adoa/core";
import { workItem } from "@adoa/db";
import { and, eq, isNull } from "drizzle-orm";
import type { MappedWorkItem } from "./models/MappedWorkItem";
import type { SyncContext } from "./models/SyncContext";
import { initialStatus, nextStatus } from "./nextStatus";

type WorkItemRow = typeof workItem.$inferSelect;

// Returns the items whose mirror changed.
export async function upsertWorkItems(ctx: SyncContext, items: MappedWorkItem[]): Promise<MappedWorkItem[]> {
  const changed: MappedWorkItem[] = [];

  for (const item of items) {
    const hasChanged = await upsertWorkItem(ctx, item);

    if (hasChanged) {
      changed.push(item);
    }
  }

  return changed;
}

async function upsertWorkItem(ctx: SyncContext, item: MappedWorkItem): Promise<boolean> {
  const [existing] = await ctx.db.select().from(workItem).where(eq(workItem.adoId, item.adoId));

  if (!existing) {
    await insertWorkItem(ctx, item);

    return true;
  }

  if (existing.rev === item.rev) {
    return linkArrivedParent(ctx, existing, item);
  }

  await updateWorkItem(ctx, existing, item);

  return true;
}

// A child whose parent came into adoa after it (e.g. a deleted parent synced by hand again) is linked on the next sync,
// not only on its next ADO change. True when it was linked.
async function linkArrivedParent(ctx: SyncContext, existing: WorkItemRow, item: MappedWorkItem): Promise<boolean> {
  if (existing.parentId !== null || item.adoParentId === null) {
    return false;
  }

  const parentId = await parentInAdoa(ctx, item);

  if (parentId === null) {
    return false;
  }

  await ctx.db.update(workItem).set({ parentId }).where(eq(workItem.adoId, item.adoId));
  await linkChild(ctx, item, null, parentId);

  return true;
}

async function insertWorkItem(ctx: SyncContext, item: MappedWorkItem): Promise<void> {
  const status = initialStatus(item.adoState);
  const parentId = await parentInAdoa(ctx, item);

  await ctx.db.insert(workItem).values({
    ...mirrorColumns(item),
    adoId: item.adoId,
    vault: ctx.vault,
    pipelineStatus: status,
    parentId,
  });
  await setPbiStatus(ctx.db, item.adoId, null, status, "sync", ctx.runId);
  await linkChild(ctx, item, null, parentId);
}

async function updateWorkItem(ctx: SyncContext, existing: WorkItemRow, item: MappedWorkItem): Promise<void> {
  const parentId = await parentInAdoa(ctx, item);

  await ctx.db.update(workItem).set({ ...mirrorColumns(item), parentId }).where(eq(workItem.adoId, item.adoId));
  await applyStatusRules(ctx, existing, item);
  await linkChild(ctx, item, existing.parentId, parentId);
}

async function applyStatusRules(ctx: SyncContext, existing: WorkItemRow, item: MappedWorkItem): Promise<void> {
  const contentChanged = existing.contentHash !== item.contentHash;
  const status = nextStatus(existing.pipelineStatus, item.adoState, contentChanged);

  if (status !== existing.pipelineStatus) {
    await setPbiStatus(ctx.db, item.adoId, existing.pipelineStatus, status, "sync", ctx.runId);
  }
}

// ADO's parent when it is a top-level PBI of this vault in adoa (children stay one level deep); else the item is
// top-level itself, e.g. a PBI under a Feature.
async function parentInAdoa(ctx: SyncContext, item: MappedWorkItem): Promise<number | null> {
  if (item.adoParentId === null) {
    return null;
  }

  const [parent] = await ctx.db
    .select({ adoId: workItem.adoId })
    .from(workItem)
    .where(and(eq(workItem.adoId, item.adoParentId), eq(workItem.vault, ctx.vault), isNull(workItem.parentId)));

  return parent?.adoId ?? null;
}

// A new child starts from its parent's skills and repos; a [BUG] Task is recorded as a bug of its parent (once).
async function linkChild(ctx: SyncContext, item: MappedWorkItem, previousParentId: number | null, parentId: number | null): Promise<void> {
  if (parentId === null) {
    return;
  }

  if (parentId !== previousParentId) {
    await inheritParentContext(ctx.db, item.adoId, parentId);
  }

  if (isMarkedBug(item.type, item.title)) {
    await recordBug(ctx.db, { workItemId: item.adoId, pbiId: parentId, source: "ado", reportedBy: "sync" });
  }
}

function mirrorColumns(item: MappedWorkItem) {
  return {
    type: item.type,
    title: item.title,
    adoState: item.adoState,
    iterationPath: item.iterationPath,
    areaPath: item.areaPath,
    assignedTo: item.assignedTo,
    priority: item.priority,
    backlogPriority: item.backlogPriority,
    effort: item.effort?.toString() ?? null,
    remainingWork: item.remainingWork?.toString() ?? null,
    tags: item.tags.join("; ") || null,
    rev: item.rev,
    contentHash: item.contentHash,
    descriptionMd: item.descriptionMd,
    acceptanceCriteriaMd: item.acceptanceCriteriaMd,
    adoChangedAt: item.adoChangedAt,
    syncedAt: new Date(),
  };
}
