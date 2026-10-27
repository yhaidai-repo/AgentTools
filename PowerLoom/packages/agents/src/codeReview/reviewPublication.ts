import { codeReview, reviewComment, type PowerLoomDb } from "@powerloom/db";
import { and, eq, inArray } from "drizzle-orm";

// The same code_review row lock as C# ReviewClosing. A writer arriving after a close reopens the review if it has
// unresolved findings. The lock, comments, effective verdict and snapshot all belong to one transaction.
export async function publishReview<T>(db: PowerLoomDb, prId: number, action: (tx: PowerLoomDb) => Promise<T>): Promise<T> {
  return db.transaction(async transaction => {
    const tx = transaction as unknown as PowerLoomDb;
    const [review] = await tx.select({ id: codeReview.prId }).from(codeReview).where(eq(codeReview.prId, prId)).for("update");
    if (!review) throw new Error(`Review ${prId} no longer exists; publication refused`);
    return action(tx);
  });
}

export async function unresolvedComments(db: PowerLoomDb, prId: number): Promise<number> {
  return (await db.select({ id: reviewComment.id }).from(reviewComment).where(and(eq(reviewComment.prId, prId), inArray(reviewComment.status, ["open", "answered"])))).length;
}

export function commentGate(count: number): string {
  return `Merge approval blocked: ${count} unresolved review comment(s), including nits. Resolve or explicitly withdraw them before approval or closure.`;
}
