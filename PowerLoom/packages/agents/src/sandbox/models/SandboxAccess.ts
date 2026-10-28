import type { FeedCredential, SandboxClient } from "@powerloom/sandbox";

// The sandbox service while the host has one (SANDBOX_URL and SANDBOX_TOKEN set): its client, where it points, and
// the run's vault's own part (Settings → Data access → Sandbox, and its Azure DevOps feeds).
export interface SandboxAccess {
  client: SandboxClient;
  url: string;
  /** The vault's package-feed sign-ins for restores. */
  feeds: FeedCredential[];
  /** The hosts the vault's restores may reach: its saved list plus its own Azure DevOps feed hosts. */
  packageHosts: string[];
  /** The vault's image from the catalog; empty for the catalog's first. */
  image: string;
}
