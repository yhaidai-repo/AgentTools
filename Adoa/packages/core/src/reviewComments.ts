import { reviewComment, type AdoaDb } from "@adoa/db";
import { eq } from "drizzle-orm";
import type { Outcome } from "./models/Outcome";

const ANSWERABLE = ["open", "answered"];

// The answer feeds the agent's next run on this PR (user decision 2026-10-02). An empty answer takes it back.
export async function answerReviewComment(db: AdoaDb, commentId: string, answer: string | null): Promise<Outcome<{ prId: number }>> {
  const [comment] = await db.select({ prId: reviewComment.prId, status: reviewComment.status }).from(reviewComment).where(eq(reviewComment.id, commentId));

  if (!comment || !ANSWERABLE.includes(comment.status)) {
    return { ok: false, error: comment ? `${commentId} is ${comment.status}; it takes no answer.` : "Unknown comment." };
  }

  await db.update(reviewComment).set({ answerMd: answer, answeredAt: answer ? new Date() : null, status: answer ? "answered" : "open", updatedAt: new Date() }).where(eq(reviewComment.id, commentId));

  return { ok: true, value: { prId: comment.prId } };
}
