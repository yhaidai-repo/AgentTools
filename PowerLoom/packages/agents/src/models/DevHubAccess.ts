import type { DevHubClient } from "@powerloom/devhub";

// The run's vault's DevHub while the vault's switch is on: DevHub client and where it points.
export interface DevHubAccess {
  client: DevHubClient;
  url: string;
}
