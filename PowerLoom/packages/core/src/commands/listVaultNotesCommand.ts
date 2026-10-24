import type { PowerLoomDb } from "@powerloom/db";
import { z } from "zod";
import type { Command } from "../models/Command";
import type { PowerLoomNote } from "../models/PowerLoomNote";
import type { VaultNote } from "../models/VaultNote";
import type { VaultNoteEntry } from "../models/VaultNoteEntry";
import { periodStart } from "../periods";
import { listVaultNotes, notesWrittenByPowerLoom } from "../vaultPage/vaultNotes";
import { withWriteActions } from "../vaultPage/vaultNoteWrites";
import { mountedVaultRoot } from "../vaultPage/vaultRoot";
import { limitInput, periodInput, vaultInput } from "./inputs";

type ListVaultNotesInput = { vault: string; period: string; writtenByPowerLoom: boolean; search?: string | undefined; limit: number };

// The Vault page's notes: every note of the docs vault, or (writtenByPowerLoom) the ones the tech-writer changed in the
// period, newest change first, with what the run did to each.
export const listVaultNotesCommand: Command<ListVaultNotesInput, VaultNoteEntry[]> = {
  name: "vault.notes",
  effect: "read",
  description: "List a docs vault's notes (path, title, authors), or with writtenByPowerLoom only the notes PowerLoom's tech-writer wrote in the period, with the run (pass RUN-<runId> to run_get) and whether it created or updated the note. search matches a substring of the path or title.",
  input: z.object({
    vault: vaultInput,
    period: periodInput,
    writtenByPowerLoom: z.boolean().default(false).describe("Only the notes PowerLoom wrote in the period, with their action and run"),
    search: z.string().trim().min(1).optional().describe("A substring of the note's path or title"),
    limit: limitInput(500, 100),
  }),
  async run(context, input) {
    const root = await mountedVaultRoot(input.vault);

    if (!root.ok) {
      return root;
    }

    const notes = await listVaultNotes(root.value);
    const entries = input.writtenByPowerLoom ? await writtenEntries(context.db, input, notes) : notes;

    return { ok: true, value: entries.filter((entry) => matchesSearch(entry, input.search)).slice(0, input.limit) };
  },
};

async function writtenEntries(db: PowerLoomDb, input: ListVaultNotesInput, notes: VaultNote[]): Promise<VaultNoteEntry[]> {
  const since = await periodStart(db, input.period, input.vault);
  const written = await withWriteActions(db, input.vault, notesWrittenByPowerLoom(notes, since));
  const authorsByPath = new Map(notes.map((note) => [note.path, note.authors]));

  return written.map((note) => withAuthors(note, authorsByPath.get(note.path) ?? []));
}

function withAuthors(note: PowerLoomNote, authors: string[]): VaultNoteEntry {
  return { path: note.path, title: note.title, authors, runId: note.runId, action: note.action, createdByRunId: note.createdByRunId };
}

function matchesSearch(entry: VaultNoteEntry, search: string | undefined): boolean {
  if (!search) {
    return true;
  }

  const needle = search.toLowerCase();

  return entry.path.toLowerCase().includes(needle) || entry.title.toLowerCase().includes(needle);
}
