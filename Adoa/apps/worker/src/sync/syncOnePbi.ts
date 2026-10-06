import { SYNC_FIELDS } from "@adoa/ado";
import { canEnterAdoa, entryRefusal, finishRun, forgetDeletedPbi, readAdoSettings, startRun, type Outcome } from "@adoa/core";
import { workItem } from "@adoa/db";
import { eq } from "drizzle-orm";
import { createAdoClient } from "../adoClient";
import type { WorkerContext } from "../models/WorkerContext";
import { mapWorkItem } from "./mapWorkItem";
import { upsertWorkItems } from "./upsertWorkItems";

// One PBI by id, from any sprint (user decision 2026-10-02). Like every PBI in adoa, full syncs refresh it from now on; a
// PBI deleted in adoa comes back. With `onlyNotStarted` (imports), a new PBI already started in ADO is refused (an error
// result); the Backlog's "Sync PBI" brings any PBI (user decision 2026-10-02). Recorded as a sync run. A new PBI joins
// `vault` (the one the user had selected, or the import's); a known one stays in its vault.
export async function syncOnePbi(context: WorkerContext, adoId: number, onlyNotStarted: boolean, vault: string): Promise<Outcome<string>> {
  const runId = await startRun(context.db, "sync");

  try {
    const outcome = await fetchAndStore(context, runId, adoId, onlyNotStarted, vault);

    await finishRun(context.db, runId, "success", null);

    return outcome;
  } catch (error) {
    await finishRun(context.db, runId, "failed", (error as Error).message);
    throw error;
  }
}

async function fetchAndStore(context: WorkerContext, runId: number, adoId: number, onlyNotStarted: boolean, vault: string): Promise<Outcome<string>> {
  const client = await createAdoClient(context.db, vault);
  const [item] = await client.getWorkItems([adoId], SYNC_FIELDS);

  if (!item) {
    throw new Error(`PBI ${adoId} isn't in Azure DevOps, or the token can't see it`);
  }

  const mapped = mapWorkItem(item);

  if (onlyNotStarted && !canEnterAdoa(mapped.adoState) && !(await isInAdoa(context, adoId))) {
    return { ok: false, error: entryRefusal(adoId, mapped.adoState) };
  }

  await forgetDeletedPbi(context.db, adoId);
  await upsertWorkItems({ db: context.db, client, ado: (await readAdoSettings(context.db, vault))!, vault, runId }, [mapped]);

  return { ok: true, value: `PBI-${adoId} synced` };
}

async function isInAdoa(context: WorkerContext, adoId: number): Promise<boolean> {
  const [row] = await context.db.select({ adoId: workItem.adoId }).from(workItem).where(eq(workItem.adoId, adoId));

  return !!row;
}
