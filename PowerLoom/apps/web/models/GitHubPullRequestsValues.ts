import type { GitHubCheckStatus } from "@powerloom/core";

// What the GitHub pull requests card shows: the check's switch, schedule and chosen repos (owner/name, of the enabled
// GitHub repos), and how its last run went.
export interface GitHubPullRequestsValues {
  enabled: boolean;
  cron: string;
  login: string;
  repos: string[];
  repoNames: string[];
  status: GitHubCheckStatus | null;
}
