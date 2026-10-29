export { branchName, countReviewStatuses, isReviewClosed, matchesReviewSearch, matchesReviewStatus, reviewNeedsYou } from "@powerloom/core";

// How a review's id reads in the list: a branch review has no PR number worth showing (user decision 2026-10-21), a local
// repo's review (local-repo, user decision 2026-10-25) is "local".
const BRANCH_REVIEWS: Record<string, { label: string; title: string; heading: string }> = {
  local: { label: "branch", title: "A branch review: no pull request", heading: "Branch review" },
  pc: { label: "branch", title: "A branch only on this PC: not code-reviewed until pushed", heading: "Branch review" },
  "local-repo": { label: "local", title: "A branch of a local repo: no pull request, no Azure DevOps", heading: "Local review" },
};

export function reviewIdLabel(pr: { id: number; origin: string; sourceRef: string }): { text: string; title: string | undefined } {
  const branch = BRANCH_REVIEWS[pr.origin];
  const number = gitHubNumber(pr);

  if (number) {
    return { text: `#${number}`, title: "A GitHub pull request" };
  }

  return branch ? { text: branch.label, title: branch.title } : { text: String(pr.id), title: undefined };
}

export function reviewHeading(pr: { id: number; origin: string; sourceRef: string }): string {
  const number = gitHubNumber(pr);

  return number ? `GitHub PR #${number}` : BRANCH_REVIEWS[pr.origin]?.heading ?? `PR ${pr.id}`;
}

// A GitHub PR's number is in its head ref (`refs/pull/<n>/head`); its id is PowerLoom's own (user decision 2026-10-25).
function gitHubNumber(pr: { origin: string; sourceRef: string }): string | null {
  return pr.origin === "github" ? (/^refs\/pull\/(\d+)\//.exec(pr.sourceRef)?.[1] ?? null) : null;
}
