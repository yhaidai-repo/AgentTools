import type { GitHubSettings } from "@powerloom/core";

// What the GitHub form shows: everything but the token, which the browser never gets.
export interface GitHubValues extends Pick<GitHubSettings, "enabled" | "owner" | "login"> {
  hasToken: boolean;
}
