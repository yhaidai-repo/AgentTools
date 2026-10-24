import type { AdoReviewerVote } from "./AdoReviewerVote";

export interface AdoPullRequest {
  id: number;
  repoId: string;
  repoName: string;
  title: string;
  description: string | null;
  status: string;
  isDraft: boolean;
  author: string | null;
  sourceRef: string;
  targetRef: string;
  sourceCommit: string | null;
  targetCommit: string | null;
  /** The commit the PR was completed with; null while it is open. */
  mergeCommit: string | null;
  /** Reviewers named on the PR (people, not groups), as unique names (e-mail). */
  reviewers: string[];
  /** Every reviewer with their vote, groups included. */
  votes: AdoReviewerVote[];
  createdAt: string | null;
  closedAt: string | null;
  /** The PR's page in the ADO web UI. */
  url: string;
}
