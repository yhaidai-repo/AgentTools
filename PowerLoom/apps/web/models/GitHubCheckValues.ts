import type { GitHubCheckStatus } from "@powerloom/core";

// The Pull requests card's GitHub line, while GitHub is connected: how its last check went.
export interface GitHubCheckValues {
  status: GitHubCheckStatus | null;
}
