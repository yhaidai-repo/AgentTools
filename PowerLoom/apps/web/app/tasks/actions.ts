"use server";

import { closeItemCommand, isCancellableFromTaskList } from "@powerloom/core";
import { localItem } from "@powerloom/db";
import { inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { runWebCommand } from "@/lib/commandContext";
import { getDb } from "@/lib/db";
import type { ActionResult } from "@/models/ActionResult";

type ItemRow = typeof localItem.$inferSelect;

// "Cancel" on the Tasks list (user request 2026-10-22): each selected task that still waits is closed as cancelled, the
// same close as its own page's; no agent takes it again. One that started or ended meanwhile is reported, not changed.
export async function cancelSelected(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const ids = [...new Set(form.getAll("taskId").map(String))];

  if (ids.length === 0) {
    return { ok: false, message: "Select at least one task." };
  }

  const tasks = await getDb().select().from(localItem).where(inArray(localItem.id, ids));
  const outcomes = await Promise.all(tasks.map(cancelOne));
  const cancelled = outcomes.filter((outcome) => outcome === null).length;
  const problems = outcomes.filter((outcome): outcome is string => outcome !== null);

  revalidatePath("/", "layout");

  const summary = `${cancelled} task(s) cancelled.`;

  return problems.length > 0 ? { ok: false, message: `${summary} Not cancelled: ${problems.join(" ")}` } : { ok: true, message: summary };
}

// null when cancelled, else why not.
async function cancelOne(task: ItemRow): Promise<string | null> {
  if (!isCancellableFromTaskList(task)) {
    return `${task.id} no longer waits (${task.status}).`;
  }

  const closed = await runWebCommand(closeItemCommand, { adoId: task.pbiId, itemId: task.id, decision: "cancel" });

  return closed.ok ? null : `${task.id}: ${closed.error}`;
}
