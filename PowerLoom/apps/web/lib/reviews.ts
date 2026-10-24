import { loadReviewDetail as loadReviewDetailOf, type ReviewDetail } from "@powerloom/core";
import type { PowerLoomDb } from "@powerloom/db";
import { getUsageStore } from "./usage";

export { REVIEW_LIST_STATUSES, loadReviewRows, reviewTaskPrId, reviewTasksOf } from "@powerloom/core";
export type { ReviewListStatus } from "@powerloom/core";

export const REVIEW_PAGE_SIZES = [25, 50, 100];

// A review of another vault is not found: every page shows only the vault picked at the top (user decision 2026-10-18).
export function loadReviewDetail(db: PowerLoomDb, prId: number, vault: string): Promise<ReviewDetail | null> {
  return loadReviewDetailOf(db, getUsageStore(), prId, vault);
}
