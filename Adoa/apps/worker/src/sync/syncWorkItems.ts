import { SYNC_FIELDS } from "@adoa/ado";
import { deletedPbiIds, readSyncCursor, readSyncSettings, saveSyncCursor } from "@adoa/core";
import { workItem } from "@adoa/db";
import { and, eq } from "drizzle-orm";
import { mapWorkItem } from "./mapWorkItem";
import type { SyncContext } from "./models/SyncContext";
import type { SyncScope } from "./models/SyncScope";
import { selectWindow } from "./selectWindow";
import { syncSprintBugs } from "./syncSprintBugs";
import { upsertWorkItems } from "./upsertWorkItems";

// Database only: notes are created later, when the user prepares a PBI for refinement. Returns the changed count.
// The sprint's PBIs plus every PBI already in the vault, minus those deleted in adoa: a PBI stays until the user deletes it
// (user decision 2026-10-02), and keeps being refreshed so ADO changes (content, Done/Removed) still reach it. The scope
// has no status filter (user decision 2026-10-09): a PBI enters in any state.
export async function syncWorkItems(ctx: SyncContext, scope: SyncScope): Promise<number> {
  const settings = await readSyncSettings(ctx.db, ctx.vault);
  const ids = await syncedIds(ctx, scope);
  const window = selectWindow(ids, await readSyncCursor(ctx.db, ctx.vault), settings.maxItemsPerRun);
  const fetched = await ctx.client.getWorkItems(window.ids, SYNC_FIELDS);
  const changed = await upsertWorkItems(ctx, fetched.map(mapWorkItem));
  const newBugs = await syncSprintBugs(ctx, scope);

  await saveSyncCursor(ctx.db, ctx.vault, window.nextCursor);

  return changed.length + newBugs;
}

async function syncedIds(ctx: SyncContext, scope: SyncScope): Promise<number[]> {
  const deleted = new Set(await deletedPbiIds(ctx.db));
  // Local PBIs have no ADO counterpart to refresh.
  const kept = await ctx.db.select({ adoId: workItem.adoId }).from(workItem).where(and(eq(workItem.vault, ctx.vault), eq(workItem.source, "ado")));
  const ids = [...new Set([...scope.allIds, ...kept.map((row) => row.adoId)])].sort((a, b) => a - b);

  return ids.filter((id) => !deleted.has(id));
}
