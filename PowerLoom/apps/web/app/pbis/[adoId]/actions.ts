"use server";

import { savePbiReposCommand, savePbiSkillsCommand } from "@powerloom/core";
import { revalidatePath } from "next/cache";
import { afterItemChange } from "@/lib/afterItemChange";
import { runWebCommand, uploadAttachments } from "@/lib/commandContext";
import { formText, readUploads } from "@/lib/formFields";
import { powerloom, powerloomResult } from "@/lib/powerloom";
import type { ActionResult } from "@/models/ActionResult";

// One or more files, chosen, pasted or dropped (user decision 2026-10-09).
export async function addAttachment(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const adoId = Number(form.get("adoId"));
  const files = await readUploads(form, "file");

  if (files.length === 0) {
    return { ok: false, message: "Choose, paste or drop a file." };
  }

  const stored = await uploadAttachments(adoId, files, { itemId: null, sourceUrl: null });

  if (!stored.ok) {
    return { ok: false, message: stored.error };
  }

  await afterItemChange(adoId);

  return { ok: true, message: `Uploaded as ${stored.value.join(", ")}.` };
}

// The user's repo list (user decision 2026-10-02); answers refinement's open repo question too.
export async function saveRepos(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const adoId = Number(form.get("adoId"));
  const saved = await runWebCommand(savePbiReposCommand, { adoId, repos: form.getAll("repo").map(String) });

  revalidatePath(`/pbis/${adoId}`, "layout");

  return saved.ok ? { ok: true, message: `Saved ${saved.value.saved} repo(s). Research and design clone these.` } : { ok: false, message: saved.error };
}

// "Load from Confluence" for a linked page whose content is missing: PowerLoom holds the token, so it fetches the page;
// it also closes the task asking for the content, and a failure becomes (or stays) that task with the reason.
export async function loadFromConfluence(adoId: number, url: string): Promise<ActionResult> {
  return powerloomResult(await powerloom.POST("/api/pbis/{adoId}/confluence-pages/load", { params: { path: { adoId } }, body: { url } }), "Loading from Confluence; reload in a few seconds.");
}

// A Confluence page added to the PBI's attachments as a link (user decision 2026-10-02): listed for the later agents with
// why, opened by agents with the Confluence tools; not fetched. A page already listed keeps its entry.
export async function addConfluenceLink(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const adoId = Number(form.get("adoId"));
  const added = await powerloom.POST("/api/pbis/{adoId}/confluence-links", { params: { path: { adoId } }, body: { url: formText(form, "url") ?? "", why: formText(form, "why") } });

  revalidatePath(`/pbis/${adoId}`);

  return powerloomResult(added, "Link added. Later agents on this PBI get it with why.");
}

export async function removeConfluenceLink(adoId: number, url: string): Promise<void> {
  await powerloom.DELETE("/api/pbis/{adoId}/confluence-links", { params: { path: { adoId } }, body: { url } });
  revalidatePath(`/pbis/${adoId}`);
}

// The user's list for the PBI's later agents; from now on refinement leaves it. Skills kept from the list keep who added them.
export async function saveSkills(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const adoId = Number(form.get("adoId"));
  const skills = form.getAll("skill").map(String).map((name) => ({ name, reason: formText(form, `reason:${name}`) ?? "" }));
  const saved = await runWebCommand(savePbiSkillsCommand, { adoId, skills });

  revalidatePath(`/pbis/${adoId}`);

  return saved.ok ? { ok: true, message: `Saved ${saved.value.saved} skill(s). The next agent runs on this PBI load them.` } : { ok: false, message: saved.error };
}

// The user's own notes: the PBI note's `## Notes` section, read by the agents with the note (user decision 2026-10-13).
export async function saveUserNotes(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const adoId = Number(form.get("adoId"));
  const body = { text: String(form.get("text") ?? ""), loadedText: String(form.get("loaded") ?? "") };
  const saved = await powerloom.PUT("/api/pbis/{adoId}/user-notes", { params: { path: { adoId } }, body });

  revalidatePath(`/pbis/${adoId}`);

  return powerloomResult(saved, "Saved to the PBI note. The next agent runs on this PBI read it.");
}
