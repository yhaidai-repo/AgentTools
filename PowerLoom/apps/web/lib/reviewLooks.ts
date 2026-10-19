import type { ReviewListStatus } from "@/lib/reviews";
import type { ReviewRow } from "@/models/ReviewRow";

export function isReviewClosed(row: ReviewRow): boolean {
  return row.review.status === "closed";
}

export function matchesReviewStatus(row: ReviewRow, status: ReviewListStatus): boolean {
  return status === "all" || row.review.status === status;
}

// An active review needs you when it has comments to answer or the PR moved past the reviewed commit (nothing re-reviews
// on its own: user decision 2026-10-02).
export function reviewNeedsYou(row: ReviewRow): boolean {
  return !isReviewClosed(row) && (row.comments.open > 0 || row.hasNewCommits);
}

export function countReviewStatuses(rows: ReviewRow[]): Record<ReviewListStatus, number> {
  const closed = rows.filter(isReviewClosed).length;

  return { active: rows.length - closed, closed, all: rows.length };
}

export function branchName(ref: string): string {
  return ref.replace(/^refs\/heads\//, "");
}
