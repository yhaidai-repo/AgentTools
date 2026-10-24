import type { PowerLoomDb, workItem } from "@powerloom/db";
import { splitNotesSection } from "@powerloom/vault";
import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import type { PbiContextBlock } from "../models/PbiContextBlock";
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
  const blocks = await pbiContextBlocks(db, backlogMount, row);

  return blocks.map((block) => block.text).join("\n\n");
}

// The context by part, so the PBI page can show what each part weighs; a part with nothing to say is left out.
export async function pbiContextBlocks(db: PowerLoomDb, backlogMount: string, row: WorkItemRow): Promise<PbiContextBlock[]> {
  const note = splitNotesSection(await readNote(backlogMount, row));
  const inputs = await loadPbiInputs(db, row.adoId);
  const blocks: PbiContextBlock[] = [
    { name: "ADO fields and note", text: `${PBI_TAG}\n${fieldLines(row).join("\n")}\n\n${note.generated}\n</pbi>` },
    { name: "your notes", text: userNotesBlock(note.userNotes) },
    { name: "parent PBI", text: await parentBlock(db, row) },
    { name: "linked documents", text: linksBlock(linkedDocuments(row), inputs.attachments) },
    { name: "attachments list", text: attachmentsBlock(inputs.attachments) },
    { name: "Confluence pages", text: confluencePagesBlock(row.confluencePages) },
    { name: "questions and tasks", text: itemsBlock(inputs.items) },
    { name: "related references", text: relatedBlock(await loadRelated(db, row), await repoLine(db, row.adoId)) },
  ];

  return blocks.filter((block) => block.text.length > 0);
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
