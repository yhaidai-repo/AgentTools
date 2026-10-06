import { nextItemId, vaultOfPbiSql } from "@adoa/core";
import { localItem, type AdoaDb } from "@adoa/db";
import type { GapItem } from "./models/GapItem";

const KINDS = { question: { kind: "question", prefix: "Q" }, task: { kind: "human", prefix: "HT" } } as const;

// The local item kind a gap becomes: a question stays a question, a task is a human task.
export function gapItemKind(item: GapItem): "question" | "human" {
  return KINDS[item.kind].kind;
}

export async function insertGapItems(db: AdoaDb, adoId: number, parentId: string, runId: number, items: GapItem[]): Promise<string[]> {
  const ids: string[] = [];

  for (const item of items) {
    ids.push(await insertGapItem(db, adoId, parentId, runId, item));
  }

  return ids;
}

async function insertGapItem(db: AdoaDb, adoId: number, parentId: string, runId: number, item: GapItem): Promise<string> {
  const { kind, prefix } = KINDS[item.kind];
  const id = await nextItemId(db, prefix, adoId);

  await db.insert(localItem).values({
    id,
    kind,
    pbiId: adoId,
    vault: vaultOfPbiSql(adoId),
    parentId,
    title: item.title.slice(0, 120),
    status: "open",
    assignee: "human",
    body: item.text,
    data: kind === "question" ? { why: item.why, options: item.options } : item.humanTask,
    createdByRun: runId,
  });

  return id;
}
