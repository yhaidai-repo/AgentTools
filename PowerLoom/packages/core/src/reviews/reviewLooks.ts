import type { ReviewListStatus } from "../models/ReviewListStatus";
import type { ReviewRow } from "../models/ReviewRow";

export function isReviewClosed(row: ReviewRow): boolean {
  return row.review.status === "closed";
}

export function unresolvedReviewComments(row: ReviewRow): number {
  return row.comments.open + row.comments.answered;
}

export function matchesReviewStatus(row: ReviewRow, status: ReviewListStatus): boolean {
  return status === "all" || (isReviewClosed(row) ? "closed" : "active") === status;
}

// An active review needs you when it has comments to answer or the PR moved past the reviewed commit (nothing re-reviews
// on its own: user decision 2026-10-02).
export function reviewNeedsYou(row: ReviewRow): boolean {
  return !isReviewClosed(row) && (unresolvedReviewComments(row) > 0 || row.hasNewCommits);
}

export function countReviewStatuses(rows: ReviewRow[]): Record<ReviewListStatus, number> {
  const closed = rows.filter(isReviewClosed).length;

  return { active: rows.length - closed, closed, all: rows.length };
}

export function branchName(ref: string): string {
  return ref.replace(/^refs\/heads\//, "");
}
