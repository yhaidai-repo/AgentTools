import type { AzureMcpServer } from "@powerloom/azure";
import type { ReadAzureSettings } from "@powerloom/core";

// The run's vault's Read Azure: its per-kind switches and Cosmos/Mongo accounts, and the Azure MCP server started
// for this run with the vault's sign-in (closed by the runner when the run ends).
export interface AzureAccess {
  settings: ReadAzureSettings;
  server: AzureMcpServer;
}
