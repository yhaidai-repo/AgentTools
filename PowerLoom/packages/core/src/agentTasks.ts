import type { localItem } from "@powerloom/db";

type ItemRow = typeof localItem.$inferSelect;

// Pipeline stages (refinement, research, design) always work on a PBI; a task of theirs without one is a bug.
export function requirePbiId(task: ItemRow): number {
  if (task.pbiId === null) {
    throw new Error(`${task.id} has no PBI, but ${task.assignee} works only on PBIs`);
  }

  return task.pbiId;
}
