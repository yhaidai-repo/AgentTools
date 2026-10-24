import { localItem, type PowerLoomDb } from "@powerloom/db";
import type { NewHumanTask } from "./models/NewHumanTask";
import { nextItemId } from "./localItemIds";
import { extractUrls } from "./urls";
import { vaultOfPbiSql } from "./vaults";

type ItemRow = typeof localItem.$inferSelect;

// The linked document a question asks for: stored by the refinement guard, or the only URL in older questions.
export function linkedUrlOf(item: ItemRow): string | null {
  const stored = (item.data as { url?: string } | null)?.url;
  const urls = extractUrls(item.body ?? "");

  return stored ?? (urls.length === 1 ? urls[0] : null);
}

export async function createHumanTask(db: PowerLoomDb, task: NewHumanTask): Promise<string> {
  const id = await nextItemId(db, "HT", task.adoId);

  await db.insert(localItem).values({
    id, kind: "human", pbiId: task.adoId, vault: vaultOfPbiSql(task.adoId), title: task.title.slice(0, 120), status: "open", assignee: "human",
    body: task.body, data: task.data, createdByRun: task.runId,
  });

  return id;
}
