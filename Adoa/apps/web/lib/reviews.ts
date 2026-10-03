import { agentRun, codeReview, localItem, pullRequest, reviewComment, type AdoaDb } from "@adoa/db";
import { desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { ReviewDetail } from "@/models/ReviewDetail";
import type { ReviewRow } from "@/models/ReviewRow";
import type { ReviewState } from "@/models/ReviewState";

export const REVIEW_LIST_STATUSES = ["active", "closed", "all"] as const;

export type ReviewListStatus = (typeof REVIEW_LIST_STATUSES)[number];

const STATE_BY_TASK_STATUS: Record<string, ReviewState> = { open: "queued", "in-progress": "reviewing", done: "reviewed", blocked: "failed" };

// Newest PRs first; active reviews by default (user decision 2026-10-02).
export async function loadReviewRows(db: AdoaDb, status: ReviewListStatus): Promise<ReviewRow[]> {
  const byStatus = status === "all" ? undefined : eq(codeReview.status, status);
  const rows = await db
    .select({ pr: pullRequest, review: codeReview, ...countColumns(), taskStatus: latestTaskStatus() })
    .from(codeReview)
    .innerJoin(pullRequest, eq(pullRequest.id, codeReview.prId))
    .where(byStatus)
    .orderBy(desc(pullRequest.adoCreatedAt), desc(pullRequest.id));

  return rows.map(toReviewRow);
}

export async function loadReviewDetail(db: AdoaDb, prId: number): Promise<ReviewDetail | null> {
  const [row] = await db
    .select({ pr: pullRequest, review: codeReview, ...countColumns(), taskStatus: latestTaskStatus() })
    .from(codeReview)
    .innerJoin(pullRequest, eq(pullRequest.id, codeReview.prId))
    .where(eq(codeReview.prId, prId));

  if (!row) {
    return null;
  }

  const tasks = await db.select().from(localItem).where(reviewTasksOf(prId)).orderBy(desc(localItem.createdAt));
  const taskIds = tasks.map((task) => task.id);
  const runs = taskIds.length > 0 ? await db.select({ id: agentRun.id, outcome: agentRun.outcome, startedAt: agentRun.startedAt, itemId: agentRun.itemId }).from(agentRun).where(inArray(agentRun.itemId, taskIds)).orderBy(desc(agentRun.id)) : [];
  const allComments = await db.select().from(reviewComment).where(eq(reviewComment.prId, prId)).orderBy(reviewComment.filePath, reviewComment.startLine, reviewComment.id);

  return { ...toReviewRow(row), allComments, tasks, runs };
}

function countColumns(): { open: SQL<number>; answered: SQL<number>; total: SQL<number> } {
  return {
    open: sql<number>`(SELECT count(*)::int FROM review_comment c WHERE c.pr_id = ${pullRequest.id} AND c.status = 'open')`,
    answered: sql<number>`(SELECT count(*)::int FROM review_comment c WHERE c.pr_id = ${pullRequest.id} AND c.status = 'answered')`,
    total: sql<number>`(SELECT count(*)::int FROM review_comment c WHERE c.pr_id = ${pullRequest.id} AND c.status <> 'withdrawn')`,
  };
}

function latestTaskStatus(): SQL<string | null> {
  return sql<string | null>`(SELECT i.status FROM local_item i WHERE i.kind = 'review' AND (i.data->>'prId')::int = ${pullRequest.id} ORDER BY i.created_at DESC LIMIT 1)`;
}

function reviewTasksOf(prId: number): SQL {
  return sql`${localItem.kind} = 'review' AND (${localItem.data}->>'prId')::int = ${prId}`;
}

function toReviewRow(row: { pr: ReviewRow["pr"]; review: ReviewRow["review"]; open: number; answered: number; total: number; taskStatus: string | null }): ReviewRow {
  const { pr, review } = row;
  const hasNewCommits = review.reviewedCommit !== null && review.reviewedCommit !== pr.sourceCommit;

  return {
    pr,
    review,
    state: STATE_BY_TASK_STATUS[row.taskStatus ?? ""] ?? "not reviewed",
    comments: { open: row.open, answered: row.answered, total: row.total },
    newPushes: review.reviewedIteration === null ? null : Math.max(0, pr.iteration - review.reviewedIteration),
    hasNewCommits,
  };
}
