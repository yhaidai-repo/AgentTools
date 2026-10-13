import type { PowerLoomDb, workItem } from "@powerloom/db";
import { buildPbiContext } from "../pbiContext/buildPbiContext";

type WorkItemRow = typeof workItem.$inferSelect;

// The first message: the task, then the PBI's context (the same one every agent run on a PBI gets).
export async function buildPbiMessage(db: PowerLoomDb, vaultRoot: string, row: WorkItemRow): Promise<string> {
  return `Refine this PBI.\n\n${await buildPbiContext(db, vaultRoot, row)}`;
}
