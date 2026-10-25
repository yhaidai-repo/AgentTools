export { branchName, countReviewStatuses, isReviewClosed, matchesReviewStatus, reviewNeedsYou } from "@powerloom/core";

// How a review's id reads in the list: a branch review has no PR number worth showing (user decision 2026-10-21), a local
// repo's review (local-repo, user decision 2026-10-25) is "local".
const BRANCH_REVIEWS: Record<string, { label: string; title: string; heading: string }> = {
  local: { label: "branch", title: "A branch review: no pull request", heading: "Branch review" },
  pc: { label: "branch", title: "A branch only on this PC: not code-reviewed until pushed", heading: "Branch review" },
  "local-repo": { label: "local", title: "A branch of a local repo: no pull request, no Azure DevOps", heading: "Local review" },
};

export function reviewIdLabel(pr: { id: number; origin: string }): { text: string; title: string | undefined } {
  const branch = BRANCH_REVIEWS[pr.origin];

  return branch ? { text: branch.label, title: branch.title } : { text: String(pr.id), title: undefined };
}

export function reviewHeading(pr: { id: number; origin: string }): string {
  return BRANCH_REVIEWS[pr.origin]?.heading ?? `PR ${pr.id}`;
}
