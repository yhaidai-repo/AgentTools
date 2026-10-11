export interface AdoPullRequest {
  id: number;
  repoId: string;
  repoName: string;
  title: string;
  description: string | null;
  isDraft: boolean;
  author: string | null;
  sourceRef: string;
  targetRef: string;
  sourceCommit: string | null;
  targetCommit: string | null;
  /** Reviewers named on the PR (people, not groups), as unique names (e-mail). */
  reviewers: string[];
  createdAt: string | null;
  /** The PR's page in the ADO web UI. */
  url: string;
}
