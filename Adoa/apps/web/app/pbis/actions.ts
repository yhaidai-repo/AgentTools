"use server";

import { PREPARE_QUEUE, SYNC_QUEUE, type PrepareJob } from "@adoa/core";
import { getBoss } from "@/lib/boss";
import type { ActionResult } from "@/models/ActionResult";

export async function syncNow(): Promise<ActionResult> {
  const boss = await getBoss();
  const jobId = await boss.send(SYNC_QUEUE);

  // The sync queue is exclusive: null means a sync is already queued or running.
  if (!jobId) {
    return { ok: true, message: "A sync is already queued or running." };
  }

  return { ok: true, message: "Sync queued. Refresh in a moment." };
}

// The web never writes the Vault; the worker renders the notes.
export async function prepareSelected(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const adoIds = form.getAll("adoId").map(Number).filter(Number.isInteger);

  if (adoIds.length === 0) {
    return { ok: false, message: "Select at least one PBI." };
  }

  const job: PrepareJob = { adoIds };

  await (await getBoss()).send(PREPARE_QUEUE, job);

  return { ok: true, message: `${adoIds.length} PBI(s) queued. Refresh in a moment.` };
}
