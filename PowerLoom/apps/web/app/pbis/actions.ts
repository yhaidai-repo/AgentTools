"use server";

import { closePbiCommand, createPbiCommand, finishPbiCommand, isAdoActive, reopenPbiCommand, savePbiReposCommand, parsePbiReference, readAdoSettings, readSyncSettings, saveSyncSettings, type Outcome, type PbiFeedback } from "@powerloom/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { runWebCommand, uploadAttachments } from "@/lib/commandContext";
import { requireVault } from "@/lib/currentVault";
import { getDb } from "@/lib/db";
import { powerloom, powerloomResult } from "@/lib/powerloom";
import { formText, readUploads } from "@/lib/formFields";
import type { ActionResult } from "@/models/ActionResult";

// The picked sprint becomes the sync setting (user decision 2026-10-02): Sync now, the scheduled sync and the Backlog
// list all follow it.
export async function syncNow(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const vault = await requireVault();
  const problem = await integrationProblem(vault);

  if (problem) {
    return { ok: false, message: problem };
  }

  await saveSyncSprint(vault, formText(form, "sprint") ?? "current");
  revalidatePath("/pbis");

  // PowerLoom runs one vault's syncs one after the other.
  return powerloomResult(await powerloom.POST("/api/ado/pbis/sync", { body: { vault, adoId: null, sources: "sprint" } }), "Sync queued. Refresh in a moment.");
}

// Syncing and importing need the vault's Azure DevOps integration (user decision 2026-10-06).
async function integrationProblem(vault: string): Promise<string | null> {
  return isAdoActive(await readAdoSettings(getDb(), vault)) ? null : `The Azure DevOps integration of ${vault} is off or incomplete: see Settings.`;
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

  return adoIds.length === 0 ? { ok: false, message: "Select at least one PBI." } : preparePbis(adoIds);
}

// The PBI page's Prepare (user decision 2026-10-06: the Backlog's actions on the PBI too).
export async function preparePbiAction(adoId: number): Promise<ActionResult> {
  const result = await preparePbis([adoId]);

  revalidatePath(`/pbis/${adoId}`);

  return result;
}

async function preparePbis(adoIds: number[]): Promise<ActionResult> {
  const prepared = await powerloom.POST("/api/pbis/prepare", { body: { adoIds } });

  if (!prepared.response.ok || !prepared.data) {
    return powerloomResult(prepared, "");
  }

  const closed = prepared.data.closed.length > 0 ? ` Skipped ${prepared.data.closed.map((adoId) => `PBI-${adoId}`).join(", ")}: closed, reopen first.` : "";

  return { ok: true, message: `${prepared.data.queued.length} PBI(s) queued: notes written and a refinement task each (it starts on the Refinement schedule or "Run now").${closed}` };
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

  if (problems.length > 0) {
    return { ok: false, message: `PBI-${created.value.adoId} created, but: ${problems.join(" ")} Open it to fix this.` };
  }

  revalidatePath("/pbis");
  redirect(`/pbis/${created.value.adoId}`);
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
  const adoId = parsePbiReference(String(form.get("pbi") ?? ""));

  if (adoId === null) {
    return { ok: false, message: "Enter a PBI or Task id, or its Azure DevOps link." };
  }

  const vault = await requireVault();
  const problem = await integrationProblem(vault);

  if (problem) {
    return { ok: false, message: problem };
  }

  return powerloomResult(await powerloom.POST("/api/ado/pbis/sync", { body: { vault, adoId, sources: null } }), `PBI-${adoId} queued; reload in a few seconds (a failure shows on the Runs page).`);
}

// PowerLoom reads the import sources; one vault's syncs run one after the other.
export async function importNow(): Promise<ActionResult> {
  const vault = await requireVault();
  const problem = await integrationProblem(vault);

  if (problem) {
    return { ok: false, message: problem };
  }

  return powerloomResult(await powerloom.POST("/api/ado/pbis/sync", { body: { vault, adoId: null, sources: "imports" } }), "Import queued; the list updates in a few seconds.");
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
