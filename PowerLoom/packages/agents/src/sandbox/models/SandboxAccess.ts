import type { FeedCredential, SandboxClient } from "@powerloom/sandbox";

// The sandbox service while the host has one (SANDBOX_URL and SANDBOX_TOKEN set): its client, where it points, and
// the run's vault's own part (Settings → Data access → Sandbox, its Azure DevOps feeds, and the vault settings
// `packageFeeds` and `repoCommands`).
export interface SandboxAccess {
  client: SandboxClient;
  url: string;
  /** The vault's package-feed sign-ins for restores. */
  feeds: FeedCredential[];
  /** The hosts the vault's restores may reach: its saved list plus its Azure DevOps and private feed hosts. */
  packageHosts: string[];
  /** The vault's image from the catalog; empty for the catalog's first. */
  image: string;
  /** The vault's package cache, shared by its sandboxes: the vault's name. */
  packageCache: string;
  /** The vault's configured build and test commands: the worktree shell sends them to the sandbox (SandboxShellRoute). */
  buildCommands: string[];
}
