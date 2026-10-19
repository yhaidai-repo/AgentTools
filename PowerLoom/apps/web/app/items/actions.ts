"use server";

import { closeItemCommand, linkedUrlOf, rerunTaskCommand, startFindingSubmit, type CloseDecision, type CloseItemRequest, type SubmitFindingRequest } from "@powerloom/core";
import { localItem } from "@powerloom/db";
import { and, eq, isNull } from "drizzle-orm";
import type { UploadedFile } from "@powerloom/attachments";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { afterItemChange } from "@/lib/afterItemChange";
import { runWebCommand, uploadAttachments, webCommandContext } from "@/lib/commandContext";
import { getDb } from "@/lib/db";
import { formAdoId, formLines, formText, readUploads } from "@/lib/formFields";
import { resolutionFromForm } from "@/lib/humanTaskAnswers";
import type { ActionResult } from "@/models/ActionResult";

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

  const closed = await runWebCommand(closeItemCommand, { ...request, resolution: resolutionFromForm(item, form, request.resolution) });

  revalidateItemPages(request.adoId);

  return closed.ok ? { ok: true, message: `${request.itemId} ${closed.value.status}.` } : { ok: false, message: closed.error };
}

// "Submit to vault": the worker's register job adds the record to the project's register and closes the finding.
export async function submitFindingAction(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const request = readSubmitRequest(form);
  const started = await startFindingSubmit(getDb(), request);

  if (!started.ok) {
    return { ok: false, message: started.error };
  }

  await webCommandContext().powerloom.addRecord(request.type === "issue" ? "known-issue" : "open-question", request.itemId);
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
  revalidatePath("/runs");
  revalidatePath("/agents/runs", "layout");

  const start = startOver ? "starts over" : "runs";

  return { ok: true, message: `${itemId} is open again: it ${start} on the agent's next schedule or "Run now".` };
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
