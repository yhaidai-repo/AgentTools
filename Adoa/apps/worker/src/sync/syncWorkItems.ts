import { SYNC_FIELDS } from "@adoa/ado";
import { readSyncCursor, readSyncSettings, saveSyncCursor } from "@adoa/core";
import { mapWorkItem } from "./mapWorkItem";
import type { SyncContext } from "./models/SyncContext";
import type { SyncScope } from "./models/SyncScope";
import { findNewlyOutOfScope, markOutOfScope } from "./outOfScope";
import { renderPbiNotes } from "./renderPbiNotes";
import { selectWindow } from "./selectWindow";
import { upsertWorkItems } from "./upsertWorkItems";

// Returns how many PBI notes were written.
export async function syncWorkItems(ctx: SyncContext, scope: SyncScope): Promise<number> {
  const settings = await readSyncSettings(ctx.db);
  const window = selectWindow(scope.allIds, await readSyncCursor(ctx.db), settings.maxItemsPerRun);
  const leftScope = await findNewlyOutOfScope(ctx.db, scope.allIds);
  const fetched = await ctx.client.getWorkItems([...window.ids, ...leftScope], SYNC_FIELDS);
  const mapped = fetched.map(mapWorkItem);
  const changed = await upsertWorkItems(ctx, mapped);

  await markOutOfScope(ctx.db, leftScope);
  await saveSyncCursor(ctx.db, window.nextCursor);

  const toRender = mapped.filter((item) => changed.includes(item) || leftScope.includes(item.adoId));

  return renderPbiNotes(ctx, toRender, scope.sprints.map((sprint) => sprint.path));
}
