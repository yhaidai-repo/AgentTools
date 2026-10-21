"use server";

import { closeItemCommand, linkedUrlOf, rerunTaskCommand, submitFindingCommand, type CloseDecision, type CloseItemRequest, type SubmitFindingRequest } from "@powerloom/core";
import { localItem } from "@powerloom/db";
import { and, eq, isNull } from "drizzle-orm";
import type { UploadedFile } from "@powerloom/attachments";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { afterItemChange } from "@/lib/afterItemChange";
import { runWebCommand, uploadAttachments, webCommandContext } from "@/lib/commandContext";
import { getDb } from "@/lib/db";
import { formAdoId, formLines, formText, readUploads } from "@/lib/formFields";
import { answersFromForm } from "@/lib/humanTaskAnswers";
import type { ActionResult } from "@/models/ActionResult";
import { powerloom, powerloomResult } from "@/lib/powerloom";

// Answer / dismiss a question or finding, finish / cancel a human task. Attached files (several, chosen, pasted or dropped)
// are stored first, and only if the item can be closed (PowerLoom's dry run).
export async function closeItem(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const files = await readUploads(form, "file");
  const request = readCloseRequest(form, files.length > 0);
  const [item] = await getDb().select().from(localItem).where(and(eq(localItem.id, request.itemId), request.adoId === null ? isNull(localItem.pbiId) : eq(localItem.pbiId, request.adoId)));
  const checked = item ? await webCommandContext().powerloom.closeItem(request, true) : { ok: false as const, error: `${request.itemId} is not an item of this PBI.` };

  if (!item || !checked.ok) {
    return { ok: false, message: checked.ok ? "Unknown item." : checked.error };
  }

  const uploadProblem = files.length > 0 ? await storeItemFiles(files, request, linkedUrlOf(item)) : null;

  if (uploadProblem) {
    return { ok: false, message: uploadProblem };
  }

  const closed = await runWebCommand(closeItemCommand, { ...request, answers: answersFromForm(item, form) });

  revalidateItemPages(request.adoId);

  return closed.ok ? { ok: true, message: `${request.itemId} ${closed.value.status}.` } : { ok: false, message: closed.error };
}

// "Submit to vault": PowerLoom adds the record to the project's register and closes the finding.
export async function submitFindingAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const request = readSubmitRequest(form);
  const submitted = await runWebCommand(submitFindingCommand, request);

  if (!submitted.ok) {
    return { ok: false, message: submitted.error };
  }

  await afterItemChange(request.adoId);

  return { ok: true, message: `${request.itemId} is on its way to the ${request.project} register; reload in a moment for its id.` };
}

// Soft delete: gone from the pages and the Vault, kept so agents don't create it again. Back to the PBI (or Tasks) page after.
export async function deleteItemAction(adoId: number | null, itemId: string): Promise<ActionResult> {
  const deleted = await webCommandContext().powerloom.deleteItem(adoId, itemId);

  if (!deleted.ok) {
    return { ok: false, message: deleted.error };
  }

  await afterItemChange(adoId);
  redirect(adoId === null ? "/tasks" : `/pbis/${adoId}`);
}

export async function rerunTaskAction(adoId: number | null, itemId: string, startOver: boolean): Promise<ActionResult> {
  const reopened = await runWebCommand(rerunTaskCommand, { adoId, itemId, startOver });

  if (!reopened.ok) {
    return { ok: false, message: reopened.error };
  }

  revalidateItemPages(adoId);
  revalidatePath("/agents");
  revalidatePath("/agents/runs", "layout");

  const start = startOver ? "starts over" : "runs";

  return { ok: true, message: `${itemId} is open again: it ${start} on the agent's next schedule or "Run now".` };
}

// An open or blocked agent task is cancelled through the same close as a human item; no agent takes it again.
export async function cancelTaskAction(adoId: number | null, itemId: string): Promise<ActionResult> {
  const cancelled = await runWebCommand(closeItemCommand, { adoId, itemId, decision: "cancel" });

  if (!cancelled.ok) {
    return { ok: false, message: cancelled.error };
  }

  revalidateItemPages(adoId);
  revalidatePath("/agents");

  return { ok: true, message: `${itemId} cancelled.` };
}

// Uploads belong to a PBI, so an item without one takes a text answer only.
async function storeItemFiles(files: UploadedFile[], request: CloseItemRequest, sourceUrl: string | null): Promise<string | null> {
  if (request.adoId === null) {
    return "Files are attached to a PBI; this item has none.";
  }

  const stored = await uploadAttachments(request.adoId, files, { itemId: request.itemId, sourceUrl });

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

// The commands went through PowerLoom; the pages only need to show the change.
function revalidateItemPages(adoId: number | null): void {
  revalidatePath(adoId === null ? "/tasks" : `/pbis/${adoId}`, "layout");
}

// A test task's own notes (user decision 2026-10-21): the Autotest agent reads them on every run. `loaded` is what the
// page showed, so a save never overwrites notes changed meanwhile.
export async function saveTaskNotes(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const id = String(form.get("itemId") ?? "");
  const result = powerloomResult(await powerloom.PUT("/api/items/{id}/user-notes", { params: { path: { id } }, body: { text: String(form.get("text") ?? ""), loadedText: String(form.get("loaded") ?? "") } }), "Notes saved; the next run reads them.");

  revalidatePath(String(form.get("path") ?? "/tasks"));

  return result;
}
