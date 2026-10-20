import { codeReview, reviewComment, type localItem } from "@powerloom/db";
import { and, eq, inArray, sql } from "drizzle-orm";
import type { ReviewResult } from "@/models/ReviewResult";
import { getDb } from "./db";

type Db = ReturnType<typeof getDb>;
type ItemRow = typeof localItem.$inferSelect;

// What a task's own runs produced that has no versions (user, 2026-10-15: every task shows its result): the review of a
// code-review task's pull request. Versioned results (refinement, design, estimate, result items) are resultVersions.
export async function loadTaskResults(db: Db, item: ItemRow, runIds: number[]) {
  return {
    review: item.kind === "review" ? await reviewOf(db, item, runIds) : null,
  };
}

async function reviewOf(db: Db, item: ItemRow, runIds: number[]): Promise<ReviewResult | null> {
  const prId = (item.data as { prId?: number } | null)?.prId;

  if (!prId) {
    return null;
  }

  const [review] = await db.select({ summary: codeReview.summaryMd }).from(codeReview).where(eq(codeReview.prId, prId)).limit(1);
  const [counts] = runIds.length === 0 ? [{ comments: 0, open: 0 }] : await db
    .select({ comments: sql<number>`count(*)::int`, open: sql<number>`count(*) filter (where ${reviewComment.status} = 'open')::int` })
    .from(reviewComment)
    .where(and(eq(reviewComment.prId, prId), inArray(reviewComment.runId, runIds)));

  return { prId, summary: review?.summary ?? null, comments: counts?.comments ?? 0, open: counts?.open ?? 0 };
}
