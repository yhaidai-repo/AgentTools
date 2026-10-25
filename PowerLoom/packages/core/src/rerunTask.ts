import type { localItem } from "@powerloom/db";
import { agentIdOf } from "./agentStages";

const RERUNNABLE: string[] = ["done", "blocked"];

type ItemRow = typeof localItem.$inferSelect;

// "Re-run" on a finished agent task (user decision 2026-10-02), or on one that failed and waits for another attempt
// (user request 2026-10-25), is PowerLoom's (TaskRerun); the pages show the button for these.
export function isRerunnableTask(item: ItemRow): boolean {
  return agentIdOf(item.assignee) !== null && item.kind !== "research-result" && (RERUNNABLE.includes(item.status) || hasFailed(item));
}

// Open again after a failed run (an attempt counted) or held with a reason (a rate limit, a check that failed).
function hasFailed(item: ItemRow): boolean {
  return item.status === "open" && (item.attempts > 0 || item.heldBy.length > 0);
}
