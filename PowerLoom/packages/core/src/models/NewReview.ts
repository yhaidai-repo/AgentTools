// Add review: a branch of an Azure DevOps repo; PowerLoom adds its active pull request, or a branch review without one.
export interface NewReview {
  vault: string;
  repo: string;
  branch: string;
  /** What a branch review is compared with; null: the repo's default branch. A PR keeps its own target. */
  targetBranch: string | null;
  /** A branch review's PBI; null: the number in the branch name. */
  pbi: string | null;
}
