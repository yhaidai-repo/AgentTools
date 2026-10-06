import { codeReview, localItem, pullRequest, type AdoaDb } from "@adoa/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { Outcome } from "./models/Outcome";
import type { ReviewTaskData } from "./models/ReviewTaskData";
import { nextScopedItemId } from "./localItemIds";
import { setItemStatus } from "./pbiStatus";

export const REVIEW_AGENT = "code-review";

const OPEN = ["open", "in-progress"] as const;

// A review task for the PR's current commit, unless one is already open (user decision 2026-10-02: new PRs get one from
// the pull-requests job; later pushes only when the user reruns). Reopens a closed review.
export async function queueReviewTask(db: AdoaDb, prId: number, commit: string, title: string): Promise<Outcome<string>> {
  const open = await openReviewTaskId(db, prId);

  if (open) {
    return { ok: false, error: `${open} is already queued for this pull request.` };
  }

  const id = await nextScopedItemId(db, `CR-${prId}-`);
  const data: ReviewTaskData = { prId, commit };
  const [pr] = await db.select({ vault: pullRequest.vault }).from(pullRequest).where(eq(pullRequest.id, prId));

  await db.insert(localItem).values({ id, kind: "review", title: `Review PR ${prId}: ${title}`.slice(0, 120), status: "open", assignee: `agent:${REVIEW_AGENT}`, data, vault: pr.vault });
  await db.update(codeReview).set({ status: "active", closedReason: null, updatedAt: new Date() }).where(eq(codeReview.prId, prId));

  return { ok: true, value: id };
}

async function openReviewTaskId(db: AdoaDb, prId: number): Promise<string | null> {
  const [row] = await db.select({ id: localItem.id }).from(localItem).where(and(reviewTaskOf(prId), inArray(localItem.status, [...OPEN]))).limit(1);

  return row?.id ?? null;
}

// Local only: ADO isn't told. A queued task is cancelled; a running one finishes, its comments still count.
export async function closeReview(db: AdoaDb, prId: number, reason: string | null, actor: string): Promise<void> {
  await db.update(codeReview).set({ status: "closed", closedReason: reason, updatedAt: new Date() }).where(eq(codeReview.prId, prId));
  await cancelQueuedReviewTasks(db, prId, actor);
}

async function cancelQueuedReviewTasks(db: AdoaDb, prId: number, actor: string): Promise<void> {
  const queued = await db.select({ id: localItem.id }).from(localItem).where(and(reviewTaskOf(prId), eq(localItem.status, "open")));

  for (const task of queued) {
    await setItemStatus(db, task.id, "open", "cancelled", actor);
  }
}

function reviewTaskOf(prId: number) {
  return and(eq(localItem.kind, "review"), sql`(${localItem.data}->>'prId')::int = ${prId}`);
}
