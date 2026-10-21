import type { localItem } from "@powerloom/db";
import { agentIdOf } from "./agentStages";

const CANCELLABLE: string[] = ["open", "blocked"];

type ItemRow = typeof localItem.$inferSelect;

// "Cancel" on an agent task of any kind that waits (user decision 2026-10-21) is PowerLoom's item close; a running one
// finishes its run first. The pages show the action for these.
export function isCancellableTask(item: ItemRow): boolean {
  return agentIdOf(item.assignee) !== null && CANCELLABLE.includes(item.status);
}
