"use server";

import { closeItemCommand, rerunTaskCommand } from "@powerloom/core";
import { localItem } from "@powerloom/db";
import { inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { runWebCommand } from "@/lib/commandContext";
import { getDb } from "@/lib/db";
import { ACTION_WORDS, taskListActionOf, taskListRefusal } from "@/lib/taskListActions";
import type { ActionResult } from "@/models/ActionResult";
import type { TaskListAction } from "@/models/TaskListAction";

type ItemRow = typeof localItem.$inferSelect;

// The Tasks list's selection bar (user requests 2026-10-22, 2026-10-25): Cancel closes each selected task that still
// waits, so no agent takes it again; Re-run and Start over reopen each finished or failed agent task, as its own page's
// buttons do. A task that started or ended meanwhile is reported, not changed.
export async function actOnSelected(_previous: ActionResult | null, form: FormData): Promise<ActionResult> {
  const ids = [...new Set(form.getAll("taskId").map(String))];
  const action = taskListActionOf(form.get("action"));

  if (ids.length === 0 || action === null) {
    return { ok: false, message: "Select at least one task." };
  }

  const tasks = await getDb().select().from(localItem).where(inArray(localItem.id, ids));
  const outcomes = await Promise.all(tasks.map((task) => actOnOne(task, action)));
  const done = outcomes.filter((outcome) => outcome === null).length;
  const problems = outcomes.filter((outcome): outcome is string => outcome !== null);
  const words = ACTION_WORDS[action];

  revalidatePath("/", "layout");

  const summary = `${done} task(s) ${words.done}.`;

  return problems.length > 0 ? { ok: false, message: `${summary} ${words.notDone}: ${problems.join(" ")}` } : { ok: true, message: summary };
}

// null when done, else why not.
async function actOnOne(task: ItemRow, action: TaskListAction): Promise<string | null> {
  const refusal = taskListRefusal(task, action);

  if (refusal) {
    return refusal;
  }

  const changed = action === "cancel"
    ? await runWebCommand(closeItemCommand, { adoId: task.pbiId, itemId: task.id, decision: "cancel" })
    : await runWebCommand(rerunTaskCommand, { adoId: task.pbiId, itemId: task.id, startOver: action === "start-over" });

  return changed.ok ? null : `${task.id}: ${changed.error}`;
}
