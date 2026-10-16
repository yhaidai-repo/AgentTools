import { codeReview, design, refinement, reviewComment, type localItem } from "@powerloom/db";
import { and, desc, eq, inArray, sql } from "drizzle-orm";
import type { ReviewResult } from "@/models/ReviewResult";
import { getDb } from "./db";

type Db = ReturnType<typeof getDb>;
type ItemRow = typeof localItem.$inferSelect;

// What a task's own runs produced where it isn't the task's resolution (user, 2026-10-15: every task shows its result):
// the refinement or design version a run wrote, or the review of a code-review task's pull request.
export async function loadTaskResults(db: Db, item: ItemRow, runIds: number[]) {
  return {
    refinement: item.kind === "refinement" ? await latestOf(db, refinement, runIds) : null,
    design: item.kind === "design" ? await latestOf(db, design, runIds) : null,
    review: item.kind === "review" ? await reviewOf(db, item, runIds) : null,
  };
}

async function latestOf<T extends typeof refinement | typeof design>(db: Db, table: T, runIds: number[]) {
  if (runIds.length === 0) {
    return null;
  }

  const [row] = await db.select().from(table as typeof refinement).where(inArray(table.runId, runIds)).orderBy(desc(table.version)).limit(1);

  return (row ?? null) as T["$inferSelect"] | null;
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
