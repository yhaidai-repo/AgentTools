"use server";

import { DISPATCH_QUEUE, closeDocumentTasks, deleteItem, rerunTask, closeHumanItem, findClosableItem, linkedUrlOf, pbiSkillProblems, savePbiSkills, type CloseDecision, type CloseItemRequest, type DispatchJob } from "@adoa/core";
import { storeAttachment, type UploadedFile } from "@adoa/attachments";
import { workItem, type PbiSkill } from "@adoa/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getBoss } from "@/lib/boss";
import { getDb } from "@/lib/db";
import { loadSkillCatalog } from "@/lib/skills";
import type { ActionResult } from "@/models/ActionResult";

// Answer / dismiss a question, finish / cancel a human task. An attached file is stored first, and only if the item can be closed.
export async function closeItem(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const file = await readUpload(form);
  const request = readCloseRequest(form, file !== null);
  const found = await findClosableItem(getDb(), request);

  if (!found.ok) {
    return { ok: false, message: found.error };
  }

  if (file) {
    const stored = await storeAttachment(getDb(), file, { adoId: request.adoId, itemId: request.itemId, sourceUrl: linkedUrlOf(found.value) });

    if (!stored.ok) {
      return { ok: false, message: stored.error };
    }
  }

  const status = await closeHumanItem(getDb(), found.value, request);

  await afterChange(request.adoId);

  return { ok: true, message: `${request.itemId} ${status}.` };
}

export async function addAttachment(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const adoId = Number(form.get("adoId"));
  const file = await readUpload(form);

  if (!file) {
    return { ok: false, message: "Choose a file." };
  }

  const sourceUrl = text(form, "sourceUrl");
  const stored = await storeAttachment(getDb(), file, { adoId, itemId: null, sourceUrl });

  if (!stored.ok) {
    return { ok: false, message: stored.error };
  }

  const closed = sourceUrl ? await closeDocumentTasks(getDb(), adoId, sourceUrl, `Uploaded as ATT-${stored.value}.`) : [];

  await afterChange(adoId);

  return { ok: true, message: `Uploaded as ATT-${stored.value}.${closed.length > 0 ? ` Closed ${closed.join(", ")}.` : ""}` };
}

// Soft delete: gone from the pages and the Vault, kept so agents don't create it again. Back to the PBI page after.
export async function deleteItemAction(adoId: number, itemId: string): Promise<ActionResult> {
  const deleted = await deleteItem(getDb(), adoId, itemId);

  if (!deleted.ok) {
    return { ok: false, message: deleted.error };
  }

  await afterChange(adoId);
  redirect(`/pbis/${adoId}`);
}

export async function rerunTaskAction(adoId: number, itemId: string): Promise<ActionResult> {
  const reopened = await rerunTask(getDb(), adoId, itemId);

  if (!reopened.ok) {
    return { ok: false, message: reopened.error };
  }

  await afterChange(adoId);

  return { ok: true, message: `${itemId} is open again: it runs on the agent's next schedule or "Run now".` };
}

// The user's list for the PBI's later agents; from now on refinement leaves it. Skills kept from the list keep who added them.
export async function saveSkills(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const adoId = Number(form.get("adoId"));
  const names = form.getAll("skill").map(String);
  const problems = pbiSkillProblems(names, (await loadSkillCatalog()).skills.map((skill) => skill.name));

  if (problems.length > 0) {
    return { ok: false, message: `Not saved: ${problems.join("; ")}.` };
  }

  const [pbi] = await getDb().select({ skills: workItem.skills }).from(workItem).where(eq(workItem.adoId, adoId));
  const skills: PbiSkill[] = names.map((name) => ({ name, reason: text(form, `reason:${name}`) ?? "", by: pbi?.skills.find((skill) => skill.name === name)?.by ?? "user" }));

  await savePbiSkills(getDb(), adoId, skills);
  revalidatePath(`/pbis/${adoId}`);

  return { ok: true, message: `Saved ${skills.length} skill(s). The next agent runs on this PBI load them.` };
}

// The web writes the DB only; a dispatcher tick now (instead of within the minute) updates the statuses and the Vault.
async function afterChange(adoId: number): Promise<void> {
  const job: DispatchJob = {};

  await (await getBoss()).send(DISPATCH_QUEUE, job);
  revalidatePath(`/pbis/${adoId}`, "layout"); // the PBI page and its item pages
}

function readCloseRequest(form: FormData, hasAttachment: boolean): CloseItemRequest {
  return {
    itemId: String(form.get("itemId")),
    adoId: Number(form.get("adoId")),
    decision: String(form.get("decision")) as CloseDecision,
    resolution: text(form, "resolution"),
    hasAttachment,
  };
}

async function readUpload(form: FormData): Promise<UploadedFile | null> {
  const file = form.get("file");

  if (!(file instanceof File) || file.size === 0) {
    return null;
  }

  return { fileName: file.name, contentType: file.type, bytes: Buffer.from(await file.arrayBuffer()) };
}

function text(form: FormData, name: string): string | null {
  const value = String(form.get(name) ?? "").trim();

  return value.length > 0 ? value : null;
}
