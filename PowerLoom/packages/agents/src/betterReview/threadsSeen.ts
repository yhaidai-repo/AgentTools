import type { AdoPrThread } from "@powerloom/ado";
import type { BetterReviewContext } from "./models/BetterReviewContext";
import type { ReviewerNote } from "./models/ReviewerNote";

// Thread id → the newest comment id a review saw in it (code_review.details.threadsSeen).
export function lastCommentIds(threads: AdoPrThread[]): Record<string, number> {
  return Object.fromEntries(threads.map((thread) => [String(thread.id), Math.max(0, ...thread.comments.map((comment) => comment.id))]));
}

// How the PR sync and Better Review remember a comment (code_review.seen_comments): "thread:comment".
export function commentKeys(threads: AdoPrThread[]): string[] {
  return threads.flatMap((thread) => thread.comments.map((comment) => `${thread.id}:${comment.id}`));
}

// Threads the last review weighed that got no comment since: their verdict carries over unless this run weighs them
// again (user decision 2026-10-16: a follow-up re-weighs only new and changed threads).
export function weighedThreads(context: BetterReviewContext): Map<number, ReviewerNote> {
  const previous = context.previous;

  if (!previous || !("threads" in context.otherReviews)) {
    return new Map();
  }

  const notes = new Map(previous.reviewerNotes.map((note) => [note.threadId, note]));
  const unchanged = context.otherReviews.threads.filter((thread) => {
    const seen = previous.threadsSeen[String(thread.id)];

    return seen !== undefined && notes.has(thread.id) && thread.comments.every((comment) => comment.id <= seen);
  });

  return new Map(unchanged.map((thread) => [thread.id, notes.get(thread.id)!]));
}

// This run's verdicts, plus the carried ones of weighed threads it didn't weigh again, in thread order.
export function reviewerNotesWithCarried(context: BetterReviewContext, notes: ReviewerNote[]): ReviewerNote[] {
  const assessed = new Set(notes.map((note) => note.threadId));
  const carried = [...weighedThreads(context).values()].filter((note) => !assessed.has(note.threadId));

  return [...carried, ...notes].sort((a, b) => a.threadId - b.threadId);
}
