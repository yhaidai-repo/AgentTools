import type { GitHubCheckStatus } from "@powerloom/core";

// What the GitHub pull requests card shows: the check's switch and schedule, and how its last run went.
export interface GitHubPullRequestsValues {
  enabled: boolean;
  cron: string;
  login: string;
  status: GitHubCheckStatus | null;
}
