import { codeReview, pullRequest, reviewComment, type AdoaDb } from "@adoa/db";
import { VaultWriter, renderReviewNote, reviewNotePath, type ReviewNote } from "@adoa/vault";
import { and, eq, ne } from "drizzle-orm";

type PullRequestRow = typeof pullRequest.$inferSelect;
type CodeReviewRow = typeof codeReview.$inferSelect;
type CommentRow = typeof reviewComment.$inferSelect;

// A PR's review as a backlog note, rendered when the user opens a Claude chat on it (the web only reads the vault).
export async function writeReviewNote(db: AdoaDb, vaultRoot: string, prId: number): Promise<string> {
  const [row] = await db.select({ pr: pullRequest, review: codeReview }).from(codeReview).innerJoin(pullRequest, eq(pullRequest.id, codeReview.prId)).where(eq(codeReview.prId, prId));

  if (!row) {
    return `PR ${prId}: no review`;
  }

  const comments = await db
    .select()
    .from(reviewComment)
    .where(and(eq(reviewComment.prId, prId), ne(reviewComment.status, "withdrawn")))
    .orderBy(reviewComment.filePath, reviewComment.startLine, reviewComment.id);

  await new VaultWriter(vaultRoot).write(reviewNotePath(prId), (notesSection) => renderReviewNote(toReviewNote(row.pr, row.review, comments), notesSection));

  return `PR ${prId}: review note written`;
}

function toReviewNote(pr: PullRequestRow, review: CodeReviewRow, comments: CommentRow[]): ReviewNote {
  return {
    prId: pr.id,
    title: pr.title,
    url: pr.url,
    author: pr.author,
    repoName: pr.repoName,
    sourceBranch: branchName(pr.sourceRef),
    targetBranch: branchName(pr.targetRef),
    sourceCommit: pr.sourceCommit,
    reviewedCommit: review.reviewedCommit,
    linkedPbis: pr.workItemIds,
    summaryMd: review.summaryMd,
    updated: review.reviewedAt ?? review.createdAt,
    comments,
  };
}

function branchName(ref: string): string {
  return ref.replace(/^refs\/heads\//, "");
}
