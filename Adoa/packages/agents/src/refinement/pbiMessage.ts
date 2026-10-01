import type { workItem } from "@adoa/db";
import { resolveInside } from "@agenttools/runtime";
import { readFile } from "node:fs/promises";

type WorkItemRow = typeof workItem.$inferSelect;

// The first message: the prepared PBI note as the user sees it (incl. their Notes), plus ADO fields.
export async function buildPbiMessage(vaultRoot: string, row: WorkItemRow): Promise<string> {
  const note = row.vaultPath ? await readFile(resolveInside(vaultRoot, row.vaultPath), "utf8") : "(no note)";
  const fields = [
    `ADO id: ${row.adoId}`,
    `Type: ${row.type}`,
    `ADO state: ${row.adoState}`,
    `Sprint: ${row.iterationPath ?? "-"}`,
    `Area: ${row.areaPath ?? "-"}`,
    `Assigned to: ${row.assignedTo ?? "-"}`,
    `Tags: ${row.tags ?? "-"}`,
  ];

  return `Refine this PBI.\n\n<pbi>\n${fields.join("\n")}\n\n${note.trim()}\n</pbi>`;
}
