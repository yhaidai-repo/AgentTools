// The Reviews page's status pills, which review.list filters by as well.
export const REVIEW_LIST_STATUSES = ["active", "closed", "all"] as const;

export type ReviewListStatus = (typeof REVIEW_LIST_STATUSES)[number];
