import { nextItemId, vaultOfPbiSql } from "@powerloom/core";
import { localItem, type PowerLoomDb } from "@powerloom/db";
import type { QuestionDraft } from "./models/QuestionDraft";

// Questions for the user on the PBI; a key marks one the app asks itself (e.g. a repo confirmation), so it isn't asked twice.
export async function insertQuestions(db: PowerLoomDb, adoId: number, runId: number, questions: QuestionDraft[], key?: string): Promise<string[]> {
  const ids: string[] = [];

  for (const question of questions) {
    const id = await nextItemId(db, "Q", adoId);

    await db.insert(localItem).values({
      id, kind: "question", pbiId: adoId, vault: vaultOfPbiSql(adoId), title: question.question.slice(0, 120), status: "open", assignee: "human",
      body: question.question, data: { why: question.why, options: question.options, ...(key ? { key } : {}) }, createdByRun: runId,
    });
    ids.push(id);
  }

  return ids;
}
