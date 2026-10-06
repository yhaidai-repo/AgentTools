import { agentRun, codeReview, deletedPullRequest, localItem, pullRequest, reviewComment, statusHistory, type AdoaDb } from "@adoa/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Outcome } from "./models/Outcome";

// Deleting a review (user decision 2026-10-06): the PR mirror, its review, comments, review tasks and their runs go;
// the pull request check won't list the PR again (deleted_pull_request). ADO is never changed.
export async function reviewDeleteProblem(db: AdoaDb, prId: number): Promise<string | null> {
  const [running] = await db
    .select({ id: agentRun.id })
    .from(agentRun)
    .innerJoin(localItem, eq(localItem.id, agentRun.itemId))
    .where(and(eq(agentRun.outcome, "running"), reviewTaskOf(prId)))
    .limit(1);

  return running ? `RUN-${running.id} is reviewing PR ${prId}; delete it when the run has ended.` : null;
}

export async function deleteReviewData(db: AdoaDb, prId: number): Promise<Outcome<string>> {
  const problem = await reviewDeleteProblem(db, prId);
  const [pr] = await db.select({ title: pullRequest.title }).from(pullRequest).where(eq(pullRequest.id, prId));

  if (problem || !pr) {
    return { ok: false, error: problem ?? `PR ${prId} isn't in adoa.` };
  }

  await db.transaction(async (tx) => {
    const taskIds = (await tx.select({ id: localItem.id }).from(localItem).where(reviewTaskOf(prId))).map((row) => row.id);

    if (taskIds.length > 0) {
      await tx.delete(statusHistory).where(inArray(statusHistory.entityId, taskIds));
      await tx.delete(agentRun).where(inArray(agentRun.itemId, taskIds));
      await tx.delete(localItem).where(inArray(localItem.id, taskIds));
    }

    await tx.delete(reviewComment).where(eq(reviewComment.prId, prId));
    await tx.delete(codeReview).where(eq(codeReview.prId, prId));
    await tx.delete(pullRequest).where(eq(pullRequest.id, prId));
    await tx.insert(deletedPullRequest).values({ id: prId, title: pr.title }).onConflictDoUpdate({ target: deletedPullRequest.id, set: { title: pr.title, deletedAt: new Date() } });
  });

  return { ok: true, value: pr.title };
}

export async function deletedPullRequestIds(db: AdoaDb): Promise<number[]> {
  return (await db.select({ id: deletedPullRequest.id }).from(deletedPullRequest)).map((row) => row.id);
}

function reviewTaskOf(prId: number) {
  return and(eq(localItem.kind, "review"), sql`(${localItem.data}->>'prId')::int = ${prId}`);
}
