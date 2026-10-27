import { localItem, vaultCapture, vaultNoteWrite, type PowerLoomDb } from "@powerloom/db";
import { and, eq, inArray } from "drizzle-orm";
import { insertFindings } from "../findings";
import { addRunOutputs } from "../tasks/runOutputs";
import type { DraftTaskData } from "./models/DraftTaskData";
import type { NoteAuthor } from "./models/NoteAuthor";
import type { NoteEdit } from "./models/NoteEdit";
import type { TaskVault } from "./models/TaskVault";
import type { TechWriterDraft } from "./models/TechWriterDraft";
import { withAuthor } from "./noteAuthors";

type ItemRow = typeof localItem.$inferSelect;

const AUTHOR = "PowerLoom tech-writer";

// A successful run: the notes are written, the draft leaves draft/ (the point of the job), PowerLoom's capture of it is
// merged, and each finding becomes an item for the user's review. Returns what was written and created, for the outputs.
export async function commitTechWriter(db: PowerLoomDb, vault: TaskVault, task: ItemRow, runId: number, draft: TechWriterDraft): Promise<string[]> {
  const data = task.data as DraftTaskData;

  await writeNotes(db, vault, runId, draft.edits);
  await vault.writer.removeFile(data.path);
  await db.update(vaultCapture).set({ status: "merged" }).where(and(eq(vaultCapture.name, data.draft), inArray(vaultCapture.status, ["created", "appended"])));

  const findingIds = await insertFindings(db, task, runId, draft.findings);

  await saveSummary(db, task, draft);

  return saveOutputs(db, runId, [...draft.edits.map((edit) => edit.path), `${data.path} removed`, ...findingIds]);
}

// An actualize task (from the vault review, user decision 2026-10-03) or a request (the user's docs task, 2026-10-15):
// notes are rewritten or created in place; there is no draft.
export async function commitActualize(db: PowerLoomDb, vault: TaskVault, task: ItemRow, runId: number, draft: TechWriterDraft): Promise<string[]> {
  await writeNotes(db, vault, runId, draft.edits);

  const findingIds = await insertFindings(db, task, runId, draft.findings);

  await saveSummary(db, task, draft);

  return saveOutputs(db, runId, [...draft.edits.map((edit) => `${vault.name}/${edit.path}`), ...findingIds]);
}

// The Vault page tells created from updated for the docs vault's notes only (vault_note_write paths are relative to it).
async function writeNotes(db: PowerLoomDb, vault: TaskVault, runId: number, edits: NoteEdit[]): Promise<void> {
  const author: NoteAuthor = { writer: AUTHOR, context: `RUN-${runId}`, date: new Date().toISOString().slice(0, 10) };

  for (const edit of edits) {
    const previous = await vault.writer.readNote(edit.path);

    await vault.writer.writeNote(edit.path, withAuthor(edit.content, previous, author));

    if (vault.isDocsVault) {
      await db.insert(vaultNoteWrite).values({ vault: vault.name, path: edit.path, runId, action: previous === null ? "created" : "updated" });
    }
  }
}

// The run's last message becomes the task's resolution: the result its page shows.
async function saveSummary(db: PowerLoomDb, task: ItemRow, draft: TechWriterDraft): Promise<void> {
  if (draft.summary) {
    await db.update(localItem).set({ resolution: draft.summary }).where(eq(localItem.id, task.id));
  }
}

async function saveOutputs(db: PowerLoomDb, runId: number, outputs: string[]): Promise<string[]> {
  await addRunOutputs(db, runId, outputs);

  return outputs;
}
