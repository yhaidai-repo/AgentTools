import type { ReviewCommentRead } from "../models/ReviewCommentRead";
import type { ReviewDetail } from "../models/ReviewDetail";
import type { ReviewRead } from "../models/ReviewRead";
import type { ReviewRow } from "../models/ReviewRow";
import type { ReviewSummary } from "../models/ReviewSummary";
import { branchName, isReviewClosed, reviewNeedsYou, unresolvedReviewComments } from "./reviewLooks";

// A comment's text is enough for a chat to understand it; the whole thread is on the review page.
const COMMENT_CHARS = 2000;

// The Reviews page's row as a chat reads it: the facts of one line, no table rows with methods.
export function toReviewSummary(row: ReviewRow): ReviewSummary {
  const { pr, review } = row;

  return {
    prId: pr.id,
    title: pr.title,
    repo: pr.repoName,
    sourceBranch: branchName(pr.sourceRef),
    targetBranch: branchName(pr.targetRef),
    author: pr.author,
    isDraft: pr.isDraft,
    origin: pr.origin,
    url: pr.url,
    workItemIds: pr.workItemIds,
    state: row.state,
    status: isReviewClosed(row) ? "closed" : "active",
    closedReason: review.closedReason,
    reviewedCommit: review.reviewedCommit,
    reviewedIteration: review.reviewedIteration,
    reviewedAt: review.reviewedAt,
    comments: row.comments,
    newPushes: row.newPushes,
    hasNewCommits: row.hasNewCommits,
    needsYou: reviewNeedsYou(row),
    createdAt: pr.adoCreatedAt,
  };
}

// The review page as a chat reads it: the summary, every comment cut short, the review tasks and their runs' costs.
export function toReviewRead(detail: ReviewDetail): ReviewRead {
  return {
    ...toReviewSummary(detail),
    summaryMd: unresolvedReviewComments(detail) ? `Merge approval blocked: ${unresolvedReviewComments(detail)} unresolved review comments, including nits. Historical summary follows.\n\n${detail.review.summaryMd ?? ""}` : detail.review.summaryMd,
    allComments: detail.allComments.map(toCommentRead),
    tasks: detail.tasks.map((task) => ({ id: task.id, status: task.status, title: task.title, createdAt: task.createdAt })),
    runs: detail.runs.map(({ run, usage }) => ({ id: run.id, outcome: run.outcome, startedAt: run.startedAt, endedAt: run.endedAt, costUsd: usage?.accountingComplete === false ? null : usage?.costUsd ?? null })),
  };
}

function toCommentRead(comment: ReviewDetail["allComments"][number]): ReviewCommentRead {
  return {
    id: comment.id,
    status: comment.status,
    severity: comment.severity,
    category: comment.category,
    file: comment.filePath,
    line: comment.startLine,
    text: cutText(comment.bodyMd, COMMENT_CHARS),
    answer: comment.answerMd,
    agentReply: comment.agentReplyMd,
  };
}

function cutText(text: string, chars: number): string {
  return text.length > chars ? `${text.slice(0, chars)}…` : text;
}
