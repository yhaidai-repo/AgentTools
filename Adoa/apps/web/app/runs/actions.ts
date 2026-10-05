"use server";

import { rerunTaskCommand } from "@adoa/core";
import { localItem } from "@adoa/db";
import { inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { runWebCommand } from "@/lib/commandContext";
import { getDb } from "@/lib/db";
import type { ActionResult } from "@/models/ActionResult";

// "Re-run selected" on the Runs page: each selected run's task reopens once (several runs can share a task); the
// dispatcher starts them on their agents' next schedule or "Run now".
export async function rerunSelected(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const ids = [...new Set(form.getAll("taskId").map(String))];

  if (ids.length === 0) {
    return { ok: false, message: "Select at least one run." };
  }

  const tasks = await getDb().select({ id: localItem.id, pbiId: localItem.pbiId }).from(localItem).where(inArray(localItem.id, ids));
  const outcomes = await Promise.all(tasks.map((task) => runWebCommand(rerunTaskCommand, { adoId: task.pbiId, itemId: task.id })));
  const reopened = outcomes.filter((outcome) => outcome.ok).length;
  const problems = outcomes.flatMap((outcome) => (outcome.ok ? [] : [outcome.error]));
  revalidatePath("/", "layout");

  const summary = `${reopened} task(s) open again: they run on their agents' next schedule or "Run now".`;

  return problems.length > 0 ? { ok: false, message: `${summary} Not reopened: ${problems.join(" ")}` } : { ok: true, message: summary };
}
