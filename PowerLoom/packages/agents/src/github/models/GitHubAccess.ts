import type { GitHubApi } from "../GitHubApi";

// The run's vault's GitHub while it is connected (Settings → Repositories → GitHub): its API with the vault's token.
export interface GitHubAccess {
  api: GitHubApi;
  login: string;
}
