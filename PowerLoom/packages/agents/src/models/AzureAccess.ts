import type { AzureMcpServer } from "@powerloom/azure";
import type { ReadAzureSettings } from "@powerloom/core";
import type { MongoAccess } from "./MongoAccess";

// The run's vault's Read Azure: its per-kind switches and Cosmos / Mongo accounts, the Azure MCP server started for
// this run with the vault's sign-in (null while neither Azure access nor Cosmos is on; closed by the runner when the
// run ends), and the Mongo reads (null while Mongo is off).
export interface AzureAccess {
  settings: ReadAzureSettings;
  server: AzureMcpServer | null;
  mongo: MongoAccess | null;
}
