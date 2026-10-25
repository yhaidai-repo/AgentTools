// Add local review: a branch of a local repo (a folder of the repos root) against a base branch, no Azure DevOps.
export interface NewLocalReview {
  vault: string;
  repo: string;
  branch: string;
  /** What the branch is compared with; null: the repo's default branch (the one its checkout had out), else main or master. */
  baseBranch: string | null;
  /** The review's PBI; null: the number in the branch name. */
  pbi: string | null;
}
