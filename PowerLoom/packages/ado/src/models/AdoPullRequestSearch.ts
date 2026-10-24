import type { AdoPullRequestStatus } from "./AdoPullRequestStatus";

// Filters of a pull request search; a missing one doesn't filter. The repository is its id or name; refs are full
// names (refs/heads/...).
export interface AdoPullRequestSearch {
  status: AdoPullRequestStatus;
  repoId?: string;
  sourceRef?: string;
  targetRef?: string;
  top: number;
}
