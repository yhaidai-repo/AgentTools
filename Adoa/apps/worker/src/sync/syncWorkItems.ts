import { SYNC_FIELDS } from "@adoa/ado";
import { canEnterAdoa, deletedPbiIds, readSyncCursor, readSyncSettings, saveSyncCursor } from "@adoa/core";
import { workItem } from "@adoa/db";
import { and, eq } from "drizzle-orm";
import { mapWorkItem } from "./mapWorkItem";
import type { MappedWorkItem } from "./models/MappedWorkItem";
import type { SyncContext } from "./models/SyncContext";
import type { SyncScope } from "./models/SyncScope";
import { selectWindow } from "./selectWindow";
import { upsertWorkItems } from "./upsertWorkItems";

// Database only: notes are created later, when the user prepares a PBI for refinement. Returns the changed count.
// The sprint's PBIs plus every PBI already in the vault, minus those deleted in adoa: a PBI stays until the user deletes it
// (user decision 2026-10-02), and keeps being refreshed so ADO changes (content, Done/Removed) still reach it.
export async function syncWorkItems(ctx: SyncContext, scope: SyncScope): Promise<number> {
  const settings = await readSyncSettings(ctx.db, ctx.vault);
  const ids = await syncedIds(ctx, scope);
  const window = selectWindow(ids, await readSyncCursor(ctx.db, ctx.vault), settings.maxItemsPerRun);
  const fetched = await ctx.client.getWorkItems(window.ids, SYNC_FIELDS);
  const changed = await upsertWorkItems(ctx, await withoutStartedNewcomers(ctx, fetched.map(mapWorkItem)));

  await saveSyncCursor(ctx.db, ctx.vault, window.nextCursor);

  return changed.length;
}

// Only PBIs nobody has started enter adoa (user decision 2026-10-02), even when the sync's states setting is wider; PBIs
// already in adoa are refreshed in any state.
async function withoutStartedNewcomers(ctx: SyncContext, items: MappedWorkItem[]): Promise<MappedWorkItem[]> {
  const known = new Set((await ctx.db.select({ adoId: workItem.adoId }).from(workItem)).map((row) => row.adoId));

  return items.filter((item) => known.has(item.adoId) || canEnterAdoa(item.adoState));
}

async function syncedIds(ctx: SyncContext, scope: SyncScope): Promise<number[]> {
  const deleted = new Set(await deletedPbiIds(ctx.db));
  // Local PBIs have no ADO counterpart to refresh.
  const kept = await ctx.db.select({ adoId: workItem.adoId }).from(workItem).where(and(eq(workItem.vault, ctx.vault), eq(workItem.source, "ado")));
  const ids = [...new Set([...scope.allIds, ...kept.map((row) => row.adoId)])].sort((a, b) => a - b);

  return ids.filter((id) => !deleted.has(id));
}
