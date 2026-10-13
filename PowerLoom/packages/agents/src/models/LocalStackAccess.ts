import type { DevHubClient } from "@powerloom/localstack";

// The run's vault's Local stack while the vault's switch is on: DevHub client and where it points.
export interface LocalStackAccess {
  client: DevHubClient;
  url: string;
}
