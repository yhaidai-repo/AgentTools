import { workItem } from "@adoa/db";
import { renderPbiNote, type PbiNote } from "@adoa/vault";
import { eq } from "drizzle-orm";
import type { MappedWorkItem } from "./models/MappedWorkItem";
import type { SyncContext } from "./models/SyncContext";

type WorkItemRow = typeof workItem.$inferSelect;

export async function renderPbiNotes(ctx: SyncContext, items: MappedWorkItem[], sprintPaths: string[]): Promise<number> {
  let written = 0;

  for (const item of items) {
    const isWritten = await renderOne(ctx, item, sprintPaths);

    written += isWritten ? 1 : 0;
  }

  return written;
}

async function renderOne(ctx: SyncContext, item: MappedWorkItem, sprintPaths: string[]): Promise<boolean> {
  const [row] = await ctx.db.select().from(workItem).where(eq(workItem.adoId, item.adoId));

  if (!row?.vaultPath) {
    return false;
  }

  const note = toPbiNote(ctx, item, row, sprintPaths);

  return ctx.writer.write(row.vaultPath, (notes) => renderPbiNote(note, notes));
}

function toPbiNote(ctx: SyncContext, item: MappedWorkItem, row: WorkItemRow, sprintPaths: string[]): PbiNote {
  return {
    adoId: item.adoId,
    title: item.title,
    type: item.type,
    adoState: item.adoState,
    adoUrl: workItemUrl(ctx, item.adoId),
    pipelineStatus: row.pipelineStatus,
    outOfScope: row.outOfScope,
    iterationPath: item.iterationPath,
    isSprintKnown: item.iterationPath !== null && sprintPaths.includes(item.iterationPath),
    areaPath: item.areaPath,
    assignedTo: item.assignedTo,
    priority: item.priority,
    effort: item.effort,
    tags: item.tags,
    descriptionHtml: item.descriptionHtml,
    acceptanceCriteriaHtml: item.acceptanceCriteriaHtml,
    created: item.adoCreatedAt ?? row.createdAt,
    updated: item.adoChangedAt ?? row.syncedAt,
  };
}

function workItemUrl(ctx: SyncContext, adoId: number): string {
  const org = ctx.ado.orgUrl.replace(/\/+$/, "");

  return `${org}/${encodeURIComponent(ctx.ado.project)}/_workitems/edit/${adoId}`;
}
