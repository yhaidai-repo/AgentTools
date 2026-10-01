import type { AdoaDb, workItem } from "@adoa/db";
import { resolveInside } from "@agenttools/runtime";
import { readFile } from "node:fs/promises";
import { linkedDocuments, linksBlock } from "../links";
import { answersBlock, attachmentsBlock, loadPbiInputs } from "../pbiInputs";

type WorkItemRow = typeof workItem.$inferSelect;

// The first message: the prepared PBI note as the user sees it (incl. their Notes), plus ADO fields,
// linked documents, the user's uploads and their answers.
export async function buildPbiMessage(db: AdoaDb, vaultRoot: string, row: WorkItemRow): Promise<string> {
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

  const inputs = await loadPbiInputs(db, row.adoId);

  return [
    "Refine this PBI.",
    `<pbi>\n${fields.join("\n")}\n\n${note.trim()}\n</pbi>`,
    linksBlock(linkedDocuments(row), inputs.attachments),
    attachmentsBlock(inputs.attachments),
    answersBlock(inputs.closedItems),
  ].join("\n\n");
}
