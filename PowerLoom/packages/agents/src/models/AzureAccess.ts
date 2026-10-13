import type { CosmosReader, LogsReader } from "@powerloom/azure";
import type { ReadAzureSettings } from "@powerloom/core";

// The run's vault's Read Azure: its per-kind switches and resources, the logs reader bound to the vault's sign-in, the
// Cosmos reader (keys come from the resources).
export interface AzureAccess {
  settings: ReadAzureSettings;
  logs: LogsReader;
  cosmos: CosmosReader;
}
