import type { localItem } from "@powerloom/db";
import { agentIdOf } from "./agentStages";

const RERUNNABLE: string[] = ["done", "blocked"];

type ItemRow = typeof localItem.$inferSelect;

// "Re-run" on a finished agent task (user decision 2026-10-02) is PowerLoom's; the pages show the button for these.
export function isRerunnableTask(item: ItemRow): boolean {
  return agentIdOf(item.assignee) !== null && item.kind !== "research-result" && RERUNNABLE.includes(item.status);
}
