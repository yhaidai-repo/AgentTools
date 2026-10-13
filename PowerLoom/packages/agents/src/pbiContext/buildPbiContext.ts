import type { PowerLoomDb, workItem } from "@powerloom/db";
import { resolveInside } from "@agenttools/runtime";
import { splitNotesSection } from "@powerloom/vault";
import { readFile } from "node:fs/promises";
import { linkedDocuments, linksBlock } from "../links";
import { parentBlock } from "../parentContext";
import { attachmentsBlock, itemsBlock, loadPbiInputs } from "../pbiInputs";
import { confluencePagesBlock } from "../relevantPages";
import { loadRelated, relatedBlock, repoLine } from "./relatedBlock";

type WorkItemRow = typeof workItem.$inferSelect;

export const PBI_TAG = "<pbi>";

// Everything a PBI holds, for every agent run on it (user decision 2026-10-13): its content inline (ADO fields, the note
// with description and acceptance criteria, the user's own notes) and everything related by reference, with the tool
// that reads each.
export async function buildPbiContext(db: PowerLoomDb, vaultRoot: string, row: WorkItemRow): Promise<string> {
  const note = splitNotesSection(await readNote(vaultRoot, row));
  const inputs = await loadPbiInputs(db, row.adoId);

  return [
    `${PBI_TAG}\n${fieldLines(row).join("\n")}\n\n${note.generated}\n</pbi>`,
    userNotesBlock(note.userNotes),
    await parentBlock(db, row),
    linksBlock(linkedDocuments(row), inputs.attachments),
    attachmentsBlock(inputs.attachments),
    confluencePagesBlock(row.confluencePages),
    itemsBlock(inputs.items),
    relatedBlock(await loadRelated(db, row), await repoLine(db, row.adoId)),
  ].filter(Boolean).join("\n\n");
}

export function hasPbiContext(message: string): boolean {
  return message.includes(PBI_TAG);
}

async function readNote(vaultRoot: string, row: WorkItemRow): Promise<string> {
  if (!row.vaultPath) {
    return "(no note: the PBI isn't prepared yet)";
  }

  return readFile(resolveInside(vaultRoot, row.vaultPath), "utf8");
}

function fieldLines(row: WorkItemRow): string[] {
  return [
    `ADO id: ${row.adoId}`,
    `Type: ${row.type}`,
    `ADO state: ${row.adoState}`,
    `Sprint: ${row.iterationPath ?? "-"}`,
    `Area: ${row.areaPath ?? "-"}`,
    `Assigned to: ${row.assignedTo ?? "-"}`,
    `Tags: ${row.tags ?? "-"}`,
  ];
}

function userNotesBlock(text: string): string {
  if (text.length === 0) {
    return "<user-notes>none</user-notes>";
  }

  return ["<user-notes>", "The user's own notes on this PBI (the note's Notes section).", text, "</user-notes>"].join("\n");
}
