"use server";

import { adoIntegrationProblem, closePbiCommand, createPbiCommand, planPbisCommand, preparePbisCommand, finishPbiCommand, importNowCommand, reopenPbiCommand, savePbiReposCommand, readSyncSettings, saveSyncSettings, syncPbisCommand, type Outcome, type PbiFeedback } from "@powerloom/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { runWebCommand, uploadAttachments } from "@/lib/commandContext";
import { requireVault } from "@/lib/currentVault";
import { getDb } from "@/lib/db";
import { powerloom, powerloomResult } from "@/lib/powerloom";
import { formText, readUploads } from "@/lib/formFields";
import type { ActionResult } from "@/models/ActionResult";
import { messageResult } from "@/lib/messageResult";

// The picked sprint becomes the sync setting (user decision 2026-10-02): Sync now, the scheduled sync and the Backlog
// list all follow it.
export async function syncNow(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const vault = await requireVault();
  const problem = await adoIntegrationProblem(getDb(), vault);

  if (problem) {
    return { ok: false, message: problem };
  }

  await saveSyncSprint(vault, formText(form, "sprint") ?? "current");
  revalidatePath("/pbis");

  // PowerLoom runs one vault's syncs one after the other.
  return messageResult(await runWebCommand(syncPbisCommand, { vault, pbi: null }));
}

async function saveSyncSprint(vault: string, sprint: string): Promise<void> {
  const settings = await readSyncSettings(getDb(), vault);

  if (settings.sprint !== sprint) {
    await saveSyncSettings(getDb(), vault, { ...settings, sprint });
  }
}

// The web never writes the Vault; PowerLoom renders the notes.
export async function prepareSelected(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const adoIds = selectedIds(form);

  return adoIds.length === 0 ? { ok: false, message: "Select at least one PBI." } : startPbis(preparePbisCommand, adoIds);
}

// Start's menu (user request 2026-10-29): the selected PBIs go to the planning agent instead of refinement.
export async function planSelected(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const adoIds = selectedIds(form);

  return adoIds.length === 0 ? { ok: false, message: "Select at least one PBI." } : startPbis(planPbisCommand, adoIds);
}

// The PBI page's Prepare (user decision 2026-10-06: the Backlog's actions on the PBI too).
export async function preparePbiAction(adoId: number): Promise<ActionResult> {
  return startPbi(preparePbisCommand, adoId);
}

export async function planPbiAction(adoId: number): Promise<ActionResult> {
  return startPbi(planPbisCommand, adoId);
}

async function startPbi(command: typeof preparePbisCommand, adoId: number): Promise<ActionResult> {
  const result = await startPbis(command, [adoId]);

  revalidatePath(`/pbis/${adoId}`);

  return result;
}

async function startPbis(command: typeof preparePbisCommand, adoIds: number[]): Promise<ActionResult> {
  const started = await runWebCommand(command, { adoIds });

  if (!started.ok) {
    return { ok: false, message: started.error };
  }

  return { ok: true, message: [started.value.message, ...started.value.skipped].join(" ") };
}

// The Backlog's Close and Reopen (user decision 2026-10-16): the selected PBIs in one request; a refused one is reported.
export async function closeSelected(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  return changeSelected(form, "/api/pbis/close");
}

export async function reopenSelected(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  return changeSelected(form, "/api/pbis/reopen");
}

async function changeSelected(form: FormData, path: "/api/pbis/close" | "/api/pbis/reopen"): Promise<ActionResult> {
  const adoIds = selectedIds(form);

  if (adoIds.length === 0) {
    return { ok: false, message: "Select at least one PBI." };
  }

  const changed = await powerloom.POST(path, { body: { adoIds, actor: null } });

  if (!changed.response.ok || !changed.data) {
    return powerloomResult(changed, "");
  }

  revalidatePath("/pbis");

  return { ok: changed.data.refused.length === 0, message: [...changed.data.done, ...changed.data.refused].join(" ") };
}

// The PBI page's Close and Reopen.
export async function closePbiAction(adoId: number): Promise<ActionResult> {
  return pageResult(adoId, await runWebCommand(closePbiCommand, { adoId }));
}

export async function reopenPbiAction(adoId: number): Promise<ActionResult> {
  return pageResult(adoId, await runWebCommand(reopenPbiCommand, { adoId }));
}

function pageResult(adoId: number, outcome: Outcome<{ message: string }>): ActionResult {
  if (!outcome.ok) {
    return { ok: false, message: outcome.error };
  }

  revalidatePath(`/pbis/${adoId}`);
  revalidatePath("/pbis");

  return { ok: true, message: outcome.value.message };
}

// The Backlog's Delete (user decision 2026-10-06): the selected PBIs in one request; a refused one is reported.
export async function deleteSelected(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const adoIds = selectedIds(form);

  if (adoIds.length === 0) {
    return { ok: false, message: "Select at least one PBI." };
  }

  const deleted = await powerloom.DELETE("/api/pbis", { body: { adoIds } });

  if (!deleted.response.ok || !deleted.data) {
    return powerloomResult(deleted, "");
  }

  revalidatePath("/pbis");

  const refused = deleted.data.refused;

  return { ok: refused.length === 0, message: `${deleted.data.deleted.length} PBI(s) deleted.${refused.length > 0 ? ` ${refused.join(" ")}` : ""}` };
}

// A PBI created in PowerLoom (user decision 2026-10-06); the page opens on it.
export async function createPbiAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const created = await runWebCommand(createPbiCommand, {
    vault: await requireVault(),
    title: formText(form, "title") ?? "",
    type: formText(form, "type") ?? "Product Backlog Item",
    priority: Number(formText(form, "priority") ?? 2),
    descriptionMd: formText(form, "descriptionMd"),
    acceptanceCriteriaMd: formText(form, "acceptanceCriteriaMd"),
  });

  if (!created.ok) {
    return { ok: false, message: created.error };
  }

  // Repos and attachments like the PBI page saves them (user decision 2026-10-06); a refused one doesn't undo the PBI.
  const problems = [...await saveNewPbiRepos(created.value.adoId, form), ...await storeNewPbiFiles(created.value.adoId, form)];

  revalidatePath("/pbis");

  // The PBI exists either way: its page opens, and a refused repo or file shows there, so the form is never left with
  // a Create button that would make a second PBI (user decision 2026-10-18).
  redirect(problems.length > 0 ? `/pbis/${created.value.adoId}?problem=${encodeURIComponent(problems.join(" "))}` : `/pbis/${created.value.adoId}`);
}

async function saveNewPbiRepos(adoId: number, form: FormData): Promise<string[]> {
  const repos = form.getAll("repo").map(String).filter(Boolean);

  if (repos.length === 0) {
    return [];
  }

  const saved = await runWebCommand(savePbiReposCommand, { adoId, repos });

  return saved.ok ? [] : [saved.error];
}

async function storeNewPbiFiles(adoId: number, form: FormData): Promise<string[]> {
  const problems: string[] = [];

  for (const file of await readUploads(form, "files")) {
    const stored = await uploadAttachments(adoId, [file], { itemId: null, sourceUrl: null });

    if (!stored.ok) {
      problems.push(`${file.fileName}: ${stored.error}`);
    }
  }

  return problems;
}

function selectedIds(form: FormData): number[] {
  return form.getAll("adoId").map(Number).filter(Number.isInteger);
}

// One PBI by id or ADO link (user decision 2026-10-02); PowerLoom holds the ADO token, so it fetches it.
export async function syncOnePbi(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const pbi = formText(form, "pbi");

  if (pbi === null) {
    return { ok: false, message: "Enter a PBI or Task id, or its Azure DevOps link." };
  }

  return messageResult(await runWebCommand(syncPbisCommand, { vault: await requireVault(), pbi }));
}

// PowerLoom reads the import sources; one vault's syncs run one after the other.
export async function importNow(): Promise<ActionResult> {
  return messageResult(await runWebCommand(importNowCommand, { vault: await requireVault() }));
}

// Deletes in PowerLoom only, through PowerLoom (it removes the PBI's notes too). Refused while an agent runs on it.
export async function deletePbiAction(adoId: number): Promise<ActionResult> {
  const deleted = await powerloom.DELETE("/api/pbis", { body: { adoIds: [adoId] } });

  if (!deleted.response.ok || !deleted.data) {
    return powerloomResult(deleted, "");
  }

  if (deleted.data.refused.length > 0) {
    return { ok: false, message: deleted.data.refused[0] };
  }

  revalidatePath("/pbis");
  redirect("/pbis");
}

// The Finish dialog, once per PBI (user decision 2026-10-05): done in PowerLoom only (ADO is never written), with the user's
// rating of the agents, the hours spent and, optionally, what went wrong (a WWW record in the docs vault's log).
export async function finishPbiAction(feedback: PbiFeedback): Promise<ActionResult> {
  const finished = await runWebCommand(finishPbiCommand, feedback);

  revalidatePath("/pbis", "layout");

  if (!finished.ok) {
    return { ok: false, message: finished.error };
  }

  return { ok: true, message: finished.value.wwwRecordId === null ? finished.value.message : `${finished.value.message} What went wrong is logged in the WWW log.` };
}
