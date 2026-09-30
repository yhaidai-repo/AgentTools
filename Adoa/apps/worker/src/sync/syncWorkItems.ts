import { SYNC_FIELDS } from "@adoa/ado";
import { readSyncCursor, readSyncSettings, saveSyncCursor } from "@adoa/core";
import { mapWorkItem } from "./mapWorkItem";
import type { SyncContext } from "./models/SyncContext";
import type { SyncScope } from "./models/SyncScope";
import { findNewlyOutOfScope, markOutOfScope } from "./outOfScope";
import { selectWindow } from "./selectWindow";
import { upsertWorkItems } from "./upsertWorkItems";

// Database only: notes are created later, when the user prepares a PBI for refinement. Returns the changed count.
export async function syncWorkItems(ctx: SyncContext, scope: SyncScope): Promise<number> {
  const settings = await readSyncSettings(ctx.db);
  const window = selectWindow(scope.allIds, await readSyncCursor(ctx.db), settings.maxItemsPerRun);
  const leftScope = await findNewlyOutOfScope(ctx.db, scope.allIds);
  const fetched = await ctx.client.getWorkItems([...window.ids, ...leftScope], SYNC_FIELDS);
  const changed = await upsertWorkItems(ctx, fetched.map(mapWorkItem));

  await markOutOfScope(ctx.db, leftScope);
  await saveSyncCursor(ctx.db, window.nextCursor);

  return changed.length;
}
