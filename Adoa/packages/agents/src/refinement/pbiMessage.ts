import type { AdoaDb, workItem } from "@adoa/db";
import { resolveInside } from "@agenttools/runtime";
import { readFile } from "node:fs/promises";
import { linkedDocuments, linksBlock } from "../links";
import { parentBlock } from "../parentContext";
import { attachmentsBlock, itemsBlock, loadPbiInputs } from "../pbiInputs";
import { confluencePagesBlock } from "../relevantPages";

type WorkItemRow = typeof workItem.$inferSelect;

// The first message: the prepared PBI note as the user sees it (incl. their Notes), plus ADO fields, the parent's
// context for a child item, linked documents, the user's uploads, and every question and task the PBI already has.
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
    await parentBlock(db, row),
    linksBlock(linkedDocuments(row), inputs.attachments),
    attachmentsBlock(inputs.attachments),
    confluencePagesBlock(row.confluencePages),
    itemsBlock(inputs.items),
  ].filter(Boolean).join("\n\n");
}
