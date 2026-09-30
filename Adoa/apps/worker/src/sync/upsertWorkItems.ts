import { setPbiStatus } from "@adoa/core";
import { workItem } from "@adoa/db";
import { eq } from "drizzle-orm";
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

  if (existing.rev === item.rev && !existing.outOfScope) {
    return false;
  }

  await ctx.db.update(workItem).set(mirrorColumns(item)).where(eq(workItem.adoId, item.adoId));
  await applyStatusRules(ctx, existing, item);

  return true;
}

async function insertWorkItem(ctx: SyncContext, item: MappedWorkItem): Promise<void> {
  const status = initialStatus(item.adoState);

  await ctx.db.insert(workItem).values({
    ...mirrorColumns(item),
    adoId: item.adoId,
    pipelineStatus: status,
  });
  await setPbiStatus(ctx.db, item.adoId, null, status, "sync", ctx.runId);
}

async function applyStatusRules(ctx: SyncContext, existing: WorkItemRow, item: MappedWorkItem): Promise<void> {
  const contentChanged = existing.contentHash !== item.contentHash;
  const status = nextStatus(existing.pipelineStatus, item.adoState, contentChanged);

  if (status !== existing.pipelineStatus) {
    await setPbiStatus(ctx.db, item.adoId, existing.pipelineStatus, status, "sync", ctx.runId);
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
    outOfScope: false,
    syncedAt: new Date(),
  };
}
