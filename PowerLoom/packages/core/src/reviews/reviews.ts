import type { UsageStore } from "@agenttools/usage";
import { agentRun, codeReview, localItem, pullRequest, reviewComment, type PowerLoomDb } from "@powerloom/db";
import { and, desc, eq, inArray, sql, type SQL } from "drizzle-orm";
import type { ReviewDetail } from "../models/ReviewDetail";
import type { ReviewRow } from "../models/ReviewRow";
import type { ReviewState } from "../models/ReviewState";

const STATE_BY_TASK_STATUS: Record<string, ReviewState> = { open: "queued", "in-progress": "reviewing", done: "reviewed", blocked: "failed" };

// Every review of the vault, newest PRs first; the page filters them by status, so its pills can count each one.
export async function loadReviewRows(db: PowerLoomDb, vault: string): Promise<ReviewRow[]> {
  const rows = await db
    .select({ pr: pullRequest, review: codeReview, ...countColumns(), taskStatus: latestTaskStatus() })
    .from(codeReview)
    .innerJoin(pullRequest, eq(pullRequest.id, codeReview.prId))
    .where(eq(pullRequest.vault, vault))
    .orderBy(desc(pullRequest.adoCreatedAt), desc(pullRequest.id));

  return rows.map(toReviewRow);
}

// A review of another vault is not found: every page shows only the vault picked at the top (user decision 2026-10-18).
export async function loadReviewDetail(db: PowerLoomDb, usage: UsageStore, prId: number, vault: string): Promise<ReviewDetail | null> {
  const [row] = await db
    .select({ pr: pullRequest, review: codeReview, ...countColumns(), taskStatus: latestTaskStatus() })
    .from(codeReview)
    .innerJoin(pullRequest, eq(pullRequest.id, codeReview.prId))
    .where(and(eq(codeReview.prId, prId), eq(pullRequest.vault, vault)));

  if (!row) {
    return null;
  }

  const tasks = await db.select().from(localItem).where(reviewTasksOf(prId)).orderBy(desc(localItem.createdAt));
  const taskIds = tasks.map((task) => task.id);
  const runs = taskIds.length > 0 ? await db.select().from(agentRun).where(inArray(agentRun.itemId, taskIds)).orderBy(desc(agentRun.id)) : [];
  const allComments = await db.select().from(reviewComment).where(eq(reviewComment.prId, prId)).orderBy(reviewComment.filePath, reviewComment.startLine, reviewComment.id);

  // The detail's gate and its displayed comments use the same read; don't retain counts from the earlier row query.
  const counts = { open: allComments.filter(comment => comment.status === "open").length, answered: allComments.filter(comment => comment.status === "answered").length, total: allComments.filter(comment => comment.status !== "withdrawn").length };
  return { ...toReviewRow({ ...row, ...counts }), allComments, tasks, runs: await withUsage(usage, runs) };
}

// Every run of the PR's review tasks, whichever review agent took them, with its tokens and cost once it ended (a run
// gets its usage record when it ends).
async function withUsage(usage: UsageStore, runs: (typeof agentRun.$inferSelect)[]): Promise<ReviewDetail["runs"]> {
  if (runs.length === 0) {
    return [];
  }

  const ids = new Set(runs.map((run) => String(run.id)));
  const from = new Date(Math.min(...runs.map((run) => run.startedAt.getTime())));
  const records = await usage.records({ from, runIds: [...ids] });
  const byRun = new Map(records.map((record) => [record.runId, record]));

  return runs.map((run) => ({ run, usage: byRun.get(String(run.id)) ?? null }));
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

export function reviewTasksOf(prId: number): SQL {
  return sql`${localItem.kind} = 'review' AND (${localItem.data}->>'prId')::int = ${prId}`;
}

// The pull request a review task reviews; null for any other item.
export function reviewTaskPrId(data: unknown): number | null {
  const prId = (data as { prId?: unknown } | null)?.prId;

  return typeof prId === "number" ? prId : null;
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
