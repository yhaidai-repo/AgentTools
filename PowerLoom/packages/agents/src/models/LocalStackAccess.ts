import type { StackBridgeClient } from "@powerloom/localstack";

// The run's vault's Local stack while the vault's switch is on: the bridge client and where it points.
export interface LocalStackAccess {
  client: StackBridgeClient;
  url: string;
}
