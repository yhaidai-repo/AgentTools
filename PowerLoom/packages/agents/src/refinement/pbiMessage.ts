import { backlogMountOf, buildPbiContext } from "@powerloom/core";
import type { PowerLoomDb, workItem } from "@powerloom/db";

type WorkItemRow = typeof workItem.$inferSelect;

// The first message: the task, then the PBI's context (the same one every agent run and Claude chat on a PBI gets).
export async function buildPbiMessage(db: PowerLoomDb, vaultRoot: string, row: WorkItemRow): Promise<string> {
  return `Refine this PBI.\n\n${await buildPbiContext(db, backlogMountOf(vaultRoot), row)}`;
}
