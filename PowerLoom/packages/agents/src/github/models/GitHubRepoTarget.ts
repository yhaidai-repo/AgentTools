import type { RepoRef } from "@agenttools/runtime";

// A GitHub repo of the vault's catalog as the GitHub tools address it: owner/name on GitHub, and the cache's RepoRef.
export interface GitHubRepoTarget {
  owner: string;
  name: string;
  ref: RepoRef;
}
