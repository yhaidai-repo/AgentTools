import type { AdoClient } from "@powerloom/ado";

// The run's vault's Azure DevOps while its integration is on and complete (Settings): a read-only client.
export interface AdoAccess {
  client: AdoClient;
  orgUrl: string;
}
