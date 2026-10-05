"use server";

import { PBI_IMPORT_QUEUE, PBI_QUEUE, PREPARE_QUEUE, SYNC_QUEUE, deletePbiCommand, finishPbiCommand, parsePbiReference, readSyncSettings, saveSyncSettings, type PbiFeedback, type PbiJob, type PrepareJob } from "@adoa/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getBoss } from "@/lib/boss";
import { runWebCommand } from "@/lib/commandContext";
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

// One PBI by id or ADO link (user decision 2026-10-02); the worker holds the ADO token, so it fetches it.
export async function syncOnePbi(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const adoId = parsePbiReference(String(form.get("pbi") ?? ""));

  if (adoId === null) {
    return { ok: false, message: "Enter a PBI or Task id, or its Azure DevOps link." };
  }

  const job: PbiJob = { action: "sync", adoId };

  await (await getBoss()).send(PBI_QUEUE, job);

  return { ok: true, message: `PBI-${adoId} queued; reload in a few seconds (a failure shows under Job errors on the Agents page).` };
}

// The worker reads the import sources; the queue is exclusive, so a second click while one is queued does nothing.
export async function importNow(): Promise<ActionResult> {
  const jobId = await (await getBoss()).send(PBI_IMPORT_QUEUE);

  return { ok: true, message: jobId ? "Import queued; the list updates in a few seconds." : "An import is already queued or running." };
}

// Deletes in adoa only, through the worker (it removes the PBI's notes too). Refused while an agent runs on it.
export async function deletePbiAction(adoId: number): Promise<ActionResult> {
  const deleted = await runWebCommand(deletePbiCommand, { adoId });

  if (!deleted.ok) {
    return { ok: false, message: deleted.error };
  }

  revalidatePath("/pbis");
  redirect("/pbis");
}

// The Finish dialog, once per PBI (user decision 2026-10-05): done in adoa only (ADO is never written), with the user's
// rating of the agents, the hours spent and, optionally, what went wrong (a WWW record in the docs vault's log).
export async function finishPbiAction(feedback: PbiFeedback): Promise<ActionResult> {
  const finished = await runWebCommand(finishPbiCommand, feedback);

  revalidatePath("/pbis", "layout");

  if (!finished.ok) {
    return { ok: false, message: finished.error };
  }

  return { ok: true, message: finished.value.wwwRecordId === null ? finished.value.message : `${finished.value.message} What went wrong is logged in the WWW log.` };
}
