import type { FeedCredential, SandboxClient } from "@powerloom/sandbox";

// The sandbox service while the host has one (SANDBOX_URL and SANDBOX_TOKEN set): its client, where it points, and
// the run's vault's package-feed sign-ins for restores.
export interface SandboxAccess {
  client: SandboxClient;
  url: string;
  feeds: FeedCredential[];
}
