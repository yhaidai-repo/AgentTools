import type { PowerLoomDb, workItem } from "@powerloom/db";
import { splitNotesSection } from "@powerloom/vault";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { vaultBacklogRoot } from "../vaults";
import { confluencePagesBlock } from "./confluencePagesBlock";
import { linkedDocuments, linksBlock } from "./linkedDocuments";
import { parentBlock } from "./parentBlock";
import { attachmentsBlock, itemsBlock, loadPbiInputs } from "./pbiInputs";
import { loadRelated, relatedBlock, repoLine } from "./relatedBlock";

type WorkItemRow = typeof workItem.$inferSelect;

export const PBI_TAG = "<pbi>";

// Everything a PBI holds, for every agent run and Claude chat on it (user decision 2026-10-13): its content inline (ADO
// fields, the note with description and acceptance criteria, the user's own notes) and everything related by
// reference, read in full with pbi.read (read_pbi for agents).
export async function buildPbiContext(db: PowerLoomDb, backlogMount: string, row: WorkItemRow): Promise<string> {
  const note = splitNotesSection(await readNote(backlogMount, row));
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

async function readNote(backlogMount: string, row: WorkItemRow): Promise<string> {
  if (!row.vaultPath) {
    return "(no note: the PBI isn't prepared yet)";
  }

  return readFile(noteFile(vaultBacklogRoot(backlogMount, row.vault), row.vaultPath), "utf8");
}

// The note path comes from the database; it must still stay inside the vault's backlog.
function noteFile(root: string, path: string): string {
  const file = resolve(root, path);

  if (!file.startsWith(resolve(root) + sep)) {
    throw new Error(`The note path ${path} leaves the backlog folder.`);
  }

  return file;
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
