"use server";

import { REGISTER_QUEUE, closeHumanItem, deleteItem, findClosableItem, linkedUrlOf, rerunTask, startFindingSubmit, type CloseDecision, type CloseItemRequest, type SubmitFindingRequest } from "@adoa/core";
import { storeAttachment, type UploadedFile } from "@adoa/attachments";
import { redirect } from "next/navigation";
import { afterItemChange } from "@/lib/afterItemChange";
import { getBoss } from "@/lib/boss";
import { getDb } from "@/lib/db";
import { formAdoId, formLines, formText, readUpload } from "@/lib/formFields";
import type { ActionResult } from "@/models/ActionResult";

// Answer / dismiss a question or finding, finish / cancel a human task. An attached file is stored first, and only if the item can be closed.
export async function closeItem(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const file = await readUpload(form);
  const request = readCloseRequest(form, file !== null);
  const found = await findClosableItem(getDb(), request);

  if (!found.ok) {
    return { ok: false, message: found.error };
  }

  const uploadProblem = file ? await storeItemFile(file, request, linkedUrlOf(found.value)) : null;

  if (uploadProblem) {
    return { ok: false, message: uploadProblem };
  }

  const status = await closeHumanItem(getDb(), found.value, request);

  await afterItemChange(request.adoId);

  return { ok: true, message: `${request.itemId} ${status}.` };
}

// "Submit to vault": the worker's register job adds the record to the project's register and closes the finding.
export async function submitFindingAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const request = readSubmitRequest(form);
  const started = await startFindingSubmit(getDb(), request);

  if (!started.ok) {
    return { ok: false, message: started.error };
  }

  await (await getBoss()).send(REGISTER_QUEUE, started.value);
  await afterItemChange(request.adoId);

  return { ok: true, message: `${request.itemId} is on its way to the ${request.project} register; reload in a moment for its id.` };
}

// Soft delete: gone from the pages and the Vault, kept so agents don't create it again. Back to the PBI (or Tasks) page after.
export async function deleteItemAction(adoId: number | null, itemId: string): Promise<ActionResult> {
  const deleted = await deleteItem(getDb(), adoId, itemId);

  if (!deleted.ok) {
    return { ok: false, message: deleted.error };
  }

  await afterItemChange(adoId);
  redirect(adoId === null ? "/tasks" : `/pbis/${adoId}`);
}

export async function rerunTaskAction(adoId: number | null, itemId: string): Promise<ActionResult> {
  const reopened = await rerunTask(getDb(), adoId, itemId);

  if (!reopened.ok) {
    return { ok: false, message: reopened.error };
  }

  await afterItemChange(adoId);

  return { ok: true, message: `${itemId} is open again: it runs on the agent's next schedule or "Run now".` };
}

// Uploads belong to a PBI, so an item without one takes a text answer only.
async function storeItemFile(file: UploadedFile, request: CloseItemRequest, sourceUrl: string | null): Promise<string | null> {
  if (request.adoId === null) {
    return "Files are attached to a PBI; this item has none.";
  }

  const stored = await storeAttachment(getDb(), file, { adoId: request.adoId, itemId: request.itemId, sourceUrl });

  return stored.ok ? null : stored.error;
}

function readCloseRequest(form: FormData, hasAttachment: boolean): CloseItemRequest {
  return {
    itemId: String(form.get("itemId")),
    adoId: formAdoId(form),
    decision: String(form.get("decision")) as CloseDecision,
    resolution: formText(form, "resolution"),
    hasAttachment,
  };
}

function readSubmitRequest(form: FormData): SubmitFindingRequest {
  return {
    itemId: String(form.get("itemId")),
    adoId: formAdoId(form),
    type: String(form.get("type")) as SubmitFindingRequest["type"],
    project: formText(form, "project") ?? "",
    title: formText(form, "title"),
    text: formText(form, "text"),
    default: formLines(form, "default"),
    options: formLines(form, "options"),
  };
}
