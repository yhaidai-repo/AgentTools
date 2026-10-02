import { SYNC_FIELDS } from "@adoa/ado";
import { deletedPbiIds, readSyncCursor, readSyncSettings, saveSyncCursor } from "@adoa/core";
import { workItem } from "@adoa/db";
import { eq } from "drizzle-orm";
import { mapWorkItem } from "./mapWorkItem";
import type { SyncContext } from "./models/SyncContext";
import type { SyncScope } from "./models/SyncScope";
import { findNewlyOutOfScope, markOutOfScope } from "./outOfScope";
import { selectWindow } from "./selectWindow";
import { upsertWorkItems } from "./upsertWorkItems";

// Database only: notes are created later, when the user prepares a PBI for refinement. Returns the changed count.
// The sprint's PBIs plus those synced by hand, minus those deleted in adoa (user decision 2026-10-02).
export async function syncWorkItems(ctx: SyncContext, scope: SyncScope): Promise<number> {
  const settings = await readSyncSettings(ctx.db);
  const ids = await syncedIds(ctx, scope);
  const window = selectWindow(ids, await readSyncCursor(ctx.db), settings.maxItemsPerRun);
  const leftScope = await findNewlyOutOfScope(ctx.db, ids);
  const fetched = await ctx.client.getWorkItems([...window.ids, ...leftScope], SYNC_FIELDS);
  const changed = await upsertWorkItems(ctx, fetched.map(mapWorkItem));

  await markOutOfScope(ctx.db, leftScope);
  await saveSyncCursor(ctx.db, window.nextCursor);

  return changed.length;
}

async function syncedIds(ctx: SyncContext, scope: SyncScope): Promise<number[]> {
  const deleted = new Set(await deletedPbiIds(ctx.db));
  const byHand = await ctx.db.select({ adoId: workItem.adoId }).from(workItem).where(eq(workItem.syncedByHand, true));
  const ids = [...new Set([...scope.allIds, ...byHand.map((row) => row.adoId)])];

  return ids.filter((id) => !deleted.has(id));
}
