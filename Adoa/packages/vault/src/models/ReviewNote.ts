import type { ReviewNoteComment } from "./ReviewNoteComment";

// A PR's review for a "Continue with Claude" chat: the PR, adoa's review summary and its comments with their answers.
export interface ReviewNote {
  prId: number;
  title: string;
  url: string;
  author: string | null;
  repoName: string;
  sourceBranch: string;
  targetBranch: string;
  sourceCommit: string;
  reviewedCommit: string | null;
  linkedPbis: number[];
  summaryMd: string | null;
  updated: Date;
  comments: ReviewNoteComment[];
}
