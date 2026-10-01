import { nextGlobalItemId } from "@adoa/core";
import { agentRun, localItem, vaultCapture, type AdoaDb } from "@adoa/db";
import { and, eq, inArray } from "drizzle-orm";
import type { DocsVault } from "../models/DocsVault";
import type { DraftTaskData } from "./models/DraftTaskData";
import type { FindingDraft } from "./models/FindingDraft";
import type { NoteAuthor } from "./models/NoteAuthor";
import type { TechWriterDraft } from "./models/TechWriterDraft";
import { withAuthor } from "./noteAuthors";

type ItemRow = typeof localItem.$inferSelect;

const AUTHOR = "adoa tech-writer";

// A successful run: the notes are written, the draft leaves draft/ (the point of the job), adoa's capture of it is
// merged, and each finding becomes an item for the user's review. Returns what was written and created, for the outputs.
export async function commitTechWriter(db: AdoaDb, docsVault: DocsVault, task: ItemRow, runId: number, draft: TechWriterDraft): Promise<string[]> {
  const data = task.data as DraftTaskData;

  const author: NoteAuthor = { writer: AUTHOR, context: `RUN-${runId}`, date: new Date().toISOString().slice(0, 10) };

  for (const edit of draft.edits) {
    await docsVault.writeNote(edit.path, withAuthor(edit.content, await docsVault.readNote(edit.path), author));
  }

  await docsVault.removeFile(data.path);
  await db.update(vaultCapture).set({ status: "merged" }).where(and(eq(vaultCapture.name, data.draft), inArray(vaultCapture.status, ["created", "appended"])));

  const findingIds = await insertFindings(db, task, runId, draft.findings);
  const outputs = [...draft.edits.map((edit) => edit.path), `${data.path} removed`, ...findingIds];

  await db.update(agentRun).set({ outputs }).where(eq(agentRun.id, runId));

  return outputs;
}

// Linked to the draft's PBI when there is one, and to the task they came from (user decision 2026-10-02).
async function insertFindings(db: AdoaDb, task: ItemRow, runId: number, findings: FindingDraft[]): Promise<string[]> {
  const ids: string[] = [];

  for (const finding of findings) {
    const id = await nextGlobalItemId(db, "F");

    await db.insert(localItem).values({
      id, kind: "finding", pbiId: task.pbiId, parentId: task.id, title: finding.title.slice(0, 120), status: "open", assignee: "human",
      body: finding.text, data: { type: finding.type, project: finding.project, default: finding.default, options: finding.options }, createdByRun: runId,
    });
    ids.push(id);
  }

  return ids;
}
