export interface PullRequestSettings {
  /** How often the pull-requests job lists the user's active PRs. */
  cron: string;
  /** PRs whose details (pushes, linked work items) are fetched per run; the rest wait for the next run. */
  maxPullRequestsPerRun: number;
  /** Repos whose PRs are listed, Azure DevOps names and GitHub owner/name; empty = every repo (user decision 2026-10-02). */
  repos: string[];
}
