import type { AzureMcpServer } from "@powerloom/azure";
import type { ReadAzureSettings } from "@powerloom/core";
import type { MongoAccess } from "./MongoAccess";
import type { ServiceBusAccess } from "./ServiceBusAccess";

// The run's vault's Read Azure: its per-kind switches and Cosmos / Mongo accounts, the Azure MCP server started for
// this run with the vault's sign-in (null while neither Azure access nor Cosmos is on; closed by the runner when the
// run ends), the Service Bus peeks (null while Azure access is off) and the Mongo reads (null while Mongo is off).
export interface AzureAccess {
  settings: ReadAzureSettings;
  server: AzureMcpServer | null;
  serviceBus: ServiceBusAccess | null;
  mongo: MongoAccess | null;
}
