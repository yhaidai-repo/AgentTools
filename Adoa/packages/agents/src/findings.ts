import { nextGlobalItemId } from "@adoa/core";
import { localItem, type AdoaDb } from "@adoa/db";
import type { FindingDraft } from "./techWriter/models/FindingDraft";

type ItemRow = typeof localItem.$inferSelect;

// Each finding becomes an item for the user's review, linked to the task's PBI when there is one and to the task it came
// from (user decision 2026-10-02). Returns the new ids.
export async function insertFindings(db: AdoaDb, task: ItemRow, runId: number, findings: FindingDraft[]): Promise<string[]> {
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
