"use server";

import { PREPARE_QUEUE, SYNC_QUEUE, readSyncSettings, saveSyncSettings, type PrepareJob } from "@adoa/core";
import { revalidatePath } from "next/cache";
import { getBoss } from "@/lib/boss";
import { getDb } from "@/lib/db";
import { formText } from "@/lib/formFields";
import type { ActionResult } from "@/models/ActionResult";

// The picked sprint becomes the sync setting (user decision 2026-10-02): Sync now, the scheduled sync and the Backlog
// list all follow it.
export async function syncNow(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  await saveSyncSprint(formText(form, "sprint") ?? "current");
  revalidatePath("/pbis");

  const boss = await getBoss();
  const jobId = await boss.send(SYNC_QUEUE);

  // The sync queue is exclusive: null means a sync is already queued or running.
  if (!jobId) {
    return { ok: true, message: "A sync is already queued or running." };
  }

  return { ok: true, message: "Sync queued. Refresh in a moment." };
}

async function saveSyncSprint(sprint: string): Promise<void> {
  const settings = await readSyncSettings(getDb());

  if (settings.sprint !== sprint) {
    await saveSyncSettings(getDb(), { ...settings, sprint });
  }
}

// The web never writes the Vault; the worker renders the notes.
export async function prepareSelected(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const adoIds = form.getAll("adoId").map(Number).filter(Number.isInteger);

  if (adoIds.length === 0) {
    return { ok: false, message: "Select at least one PBI." };
  }

  const job: PrepareJob = { adoIds };

  await (await getBoss()).send(PREPARE_QUEUE, job);

  return { ok: true, message: `${adoIds.length} PBI(s) queued: notes written and a refinement task each (it starts on the Refinement schedule or "Run now").` };
}
