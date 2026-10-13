import { nextItemId, renderHumanTaskBody, vaultOfPbiSql, type HumanTaskData } from "@powerloom/core";
import { localItem, vaultCapture, type PowerLoomDb } from "@powerloom/db";
import { eq } from "drizzle-orm";
import type { DraftTaskData } from "./models/DraftTaskData";

type ItemRow = typeof localItem.$inferSelect;

const KEY_PREFIX = "draft-merge:";

// A blocked merge task no longer holds the agents that wait for drafts (TaskValidation), so the draft would stay unmerged
// unnoticed; the user gets one task to merge or drop it instead (user decision 2026-10-13). Any other task: nothing.
export async function askUserAboutBlockedDraft(db: PowerLoomDb, task: ItemRow, reason: string): Promise<string | null> {
  const draft = (task.data as Partial<DraftTaskData> | null)?.draft;

  if (task.kind !== "docs" || !draft) {
    return null;
  }

  const [capture] = await db.select({ pbiId: vaultCapture.pbiId }).from(vaultCapture).where(eq(vaultCapture.name, draft));

  return capture ? insertDraftTask(db, capture.pbiId, task, draft, reason) : null;
}

export function blockedDraftTask(taskId: string, draft: string, reason: string): HumanTaskData {
  return {
    why: `The tech-writer couldn't merge vault draft ${draft}; ${taskId} is blocked. ${reason}`.slice(0, 300),
    solves: "The draft's facts reach the docs vault, or it is dropped on purpose; agents no longer wait for it.",
    steps: [{
      action: `Fix what blocked ${taskId} and Re-run it, or merge the draft into its target note by hand and delete it, or delete it`,
      source: "other",
      resource: `Docs vault draft ${draft} (task ${taskId})`,
      query: null,
      timeRange: null,
      reportBack: "Re-run, merged by hand, or dropped",
    }],
  };
}

async function insertDraftTask(db: PowerLoomDb, pbiId: number, task: ItemRow, draft: string, reason: string): Promise<string> {
  const id = await nextItemId(db, "HT", pbiId);
  const human = blockedDraftTask(task.id, draft, reason);

  // The key makes a second block of the same draft a no-op (unique per PBI and key).
  await db.insert(localItem).values({
    id,
    kind: "human",
    pbiId,
    vault: vaultOfPbiSql(pbiId),
    parentId: task.id,
    title: `Merge or drop vault draft ${draft}`.slice(0, 120),
    status: "open",
    assignee: "human",
    body: renderHumanTaskBody(human),
    data: { ...human, key: `${KEY_PREFIX}${draft}` },
  }).onConflictDoNothing();

  return id;
}
