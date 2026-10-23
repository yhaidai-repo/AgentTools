import type { ReviewState } from "./ReviewState";

// One review as review.list answers it: the pull request's facts, PowerLoom's review of it and what still needs the user.
export interface ReviewSummary {
  prId: number;
  title: string;
  repo: string;
  sourceBranch: string;
  targetBranch: string;
  author: string | null;
  isDraft: boolean;
  origin: string;
  url: string;
  workItemIds: number[];
  state: ReviewState;
  status: string;
  closedReason: string | null;
  reviewedCommit: string | null;
  reviewedIteration: number | null;
  reviewedAt: Date | null;
  comments: { open: number; answered: number; total: number };
  newPushes: number | null;
  hasNewCommits: boolean;
  needsYou: boolean;
  createdAt: Date | null;
}
