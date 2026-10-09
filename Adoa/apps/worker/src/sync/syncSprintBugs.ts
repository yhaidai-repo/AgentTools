import { SYNC_FIELDS } from "@adoa/ado";
import { deletedPbiIds } from "@adoa/core";
import { workItem } from "@adoa/db";
import { mapWorkItem } from "./mapWorkItem";
import type { MappedWorkItem } from "./models/MappedWorkItem";
import type { SyncContext } from "./models/SyncContext";
import type { SyncScope } from "./models/SyncScope";
import { upsertWorkItems } from "./upsertWorkItems";

// The scope's [BUG] Tasks (the user's, in the sync sprint, any state; user decision 2026-10-09). Only new bugs are
// fetched here: known ones are refreshed with the vault's other items. A bug's parent comes first when the PBI window
// hasn't brought it yet, so the bug always finds it. Returns how many items (bugs and parents) came in.
export async function syncSprintBugs(ctx: SyncContext, scope: SyncScope): Promise<number> {
  const skipped = new Set([...(await knownIds(ctx)), ...(await deletedPbiIds(ctx.db))]);
  const newIds = scope.bugIds.filter((id) => !skipped.has(id));

  if (newIds.length === 0) {
    return 0;
  }

  const bugs = (await ctx.client.getWorkItems(newIds, SYNC_FIELDS)).map(mapWorkItem);
  const parents = await fetchMissingParents(ctx, bugs, skipped);
  const changed = [...(await upsertWorkItems(ctx, parents)), ...(await upsertWorkItems(ctx, bugs))];

  return changed.length;
}

// A parent the user deleted stays deleted; its bugs come in unlinked.
async function fetchMissingParents(ctx: SyncContext, bugs: MappedWorkItem[], skipped: Set<number>): Promise<MappedWorkItem[]> {
  const parentIds = [...new Set(bugs.map((bug) => bug.adoParentId))].filter((id): id is number => id !== null && !skipped.has(id));

  if (parentIds.length === 0) {
    return [];
  }

  return (await ctx.client.getWorkItems(parentIds, SYNC_FIELDS)).map(mapWorkItem);
}

async function knownIds(ctx: SyncContext): Promise<number[]> {
  return (await ctx.db.select({ adoId: workItem.adoId }).from(workItem)).map((row) => row.adoId);
}
