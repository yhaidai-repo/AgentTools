import type { localItem } from "@powerloom/db";
import { agentIdOf } from "./agentStages";

const CANCELLABLE: string[] = ["open", "blocked"];

type ItemRow = typeof localItem.$inferSelect;

// "Cancel" on an agent task of any kind that waits (user decision 2026-10-21) is PowerLoom's item close; a running one
// finishes its run first. The pages show the action for these.
export function isCancellableTask(item: ItemRow): boolean {
  return agentIdOf(item.assignee) !== null && CANCELLABLE.includes(item.status);
}

// The Tasks list cancels in bulk (user request 2026-10-22): those agent tasks, and a human task that still waits on the
// person (its own page cancels it through the close form).
export function isCancellableFromTaskList(item: ItemRow): boolean {
  return isCancellableTask(item) || (item.kind === "human" && item.status === "open");
}
