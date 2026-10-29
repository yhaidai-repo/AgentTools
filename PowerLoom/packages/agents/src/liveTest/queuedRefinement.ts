import { runCommand, type CommandContext } from "@powerloom/core";
import { localItem } from "@powerloom/db";
import { and, eq, inArray } from "drizzle-orm";
import { commandNamed } from "./liveTestCommands";

const WAIT_MS = 15_000;
const POLL_MS = 250;

// bug.report has the backend prepare the new bug in the background, which queues a refinement task for any agent
// taking refinement; that would start a run and spend budget, and a PBI an agent works on can't be deleted. A live test
// deletes that task as soon as the backend has queued it, so no refinement agent ever takes it. `adoIds` are the PBIs
// whose preparing is known to queue a task: the wait is for those only.
export async function deleteQueuedRefinement(context: CommandContext, adoIds: number[], waitMs = WAIT_MS): Promise<string | null> {
  const tasks = await waitForRefinementTasks(context, adoIds, waitMs);
  const missing = adoIds.filter((adoId) => !tasks.some((task) => task.pbiId === adoId));
  const failed = await deleteAll(context, tasks);
  const problems = [...missing.map((adoId) => `no refinement task appeared for PBI-${adoId} within ${waitMs / 1000} s: delete it with item_delete once it does`), ...failed];

  return problems.length > 0 ? problems.join("; ") : null;
}

async function waitForRefinementTasks(context: CommandContext, adoIds: number[], waitMs: number): Promise<{ id: string; pbiId: number | null }[]> {
  const deadline = Date.now() + waitMs;
  let tasks = await openRefinementTasks(context, adoIds);

  while (tasks.length < adoIds.length && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    tasks = await openRefinementTasks(context, adoIds);
  }

  return tasks;
}

function openRefinementTasks(context: CommandContext, adoIds: number[]): Promise<{ id: string; pbiId: number | null }[]> {
  return context.db.select({ id: localItem.id, pbiId: localItem.pbiId }).from(localItem)
    .where(and(inArray(localItem.pbiId, adoIds), eq(localItem.kind, "refinement"), eq(localItem.status, "open")));
}

async function deleteAll(context: CommandContext, tasks: { id: string; pbiId: number | null }[]): Promise<string[]> {
  const failures: string[] = [];

  for (const task of tasks) {
    const deleted = await runCommand(commandNamed("item.delete"), context, { adoId: task.pbiId, itemId: task.id });

    failures.push(...(deleted.ok ? [] : [`its refinement task ${task.id} couldn't be deleted: ${deleted.error}`]));
  }

  return failures;
}
