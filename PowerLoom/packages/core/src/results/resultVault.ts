import { localItem, pullRequest, type PowerLoomDb } from "@powerloom/db";
import { eq } from "drizzle-orm";
import type { AgentResult } from "../models/AgentResult";
import type { ResultOwner } from "../models/ResultOwner";
import { vaultOfPbi } from "../vaults";

// The vault a result belongs to, the way its page is scoped: a review run's pull request, else the owner task, else
// the owner PBI; null when nothing owns it any more (its task and PBI were deleted).
export async function resultVault(db: PowerLoomDb, result: AgentResult, owner: ResultOwner): Promise<string | null> {
  if (result.kind === "review") {
    return vaultOfPr(db, result.row.prId);
  }

  if (owner.taskId !== null) {
    return vaultOfTask(db, owner.taskId);
  }

  return owner.pbiId === null ? null : vaultOfPbi(db, owner.pbiId);
}

export async function vaultOfPr(db: PowerLoomDb, prId: number): Promise<string | null> {
  const [pr] = await db.select({ vault: pullRequest.vault }).from(pullRequest).where(eq(pullRequest.id, prId));

  return pr?.vault ?? null;
}

export async function vaultOfTask(db: PowerLoomDb, taskId: string): Promise<string | null> {
  const [task] = await db.select({ vault: localItem.vault }).from(localItem).where(eq(localItem.id, taskId));

  return task?.vault ?? null;
}
