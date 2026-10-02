import { SYNC_FIELDS } from "@adoa/ado";
import { finishRun, forgetDeletedPbi, readAdoSettings, startRun } from "@adoa/core";
import { workItem } from "@adoa/db";
import { eq } from "drizzle-orm";
import { createAdoClient } from "../adoClient";
import type { WorkerContext } from "../models/WorkerContext";
import { mapWorkItem } from "./mapWorkItem";
import { upsertWorkItems } from "./upsertWorkItems";

// "Sync PBI" on the Backlog (user decision 2026-10-02): one PBI by id, from any sprint. It stays in scope from now on (full
// syncs refresh it too), and a PBI deleted in adoa comes back. Recorded as a sync run.
export async function syncOnePbi(context: WorkerContext, adoId: number): Promise<string> {
  const runId = await startRun(context.db, "sync");

  try {
    const message = await fetchAndStore(context, runId, adoId);

    await finishRun(context.db, runId, "success", null);

    return message;
  } catch (error) {
    await finishRun(context.db, runId, "failed", (error as Error).message);
    throw error;
  }
}

async function fetchAndStore(context: WorkerContext, runId: number, adoId: number): Promise<string> {
  const client = await createAdoClient(context.db);
  const [item] = await client.getWorkItems([adoId], SYNC_FIELDS);

  if (!item) {
    throw new Error(`PBI ${adoId} isn't in Azure DevOps, or the token can't see it`);
  }

  await forgetDeletedPbi(context.db, adoId);
  await upsertWorkItems({ db: context.db, client, ado: (await readAdoSettings(context.db))!, runId }, [mapWorkItem(item)]);
  await context.db.update(workItem).set({ syncedByHand: true }).where(eq(workItem.adoId, adoId));

  return `PBI-${adoId} synced`;
}
