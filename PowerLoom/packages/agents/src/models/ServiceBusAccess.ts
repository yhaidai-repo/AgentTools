import type { ServiceBusPeeker } from "@powerloom/azure";

// The run's Service Bus peeks, with the vault's sign-in (the counts come from the Azure MCP server).
export interface ServiceBusAccess {
  peeker: ServiceBusPeeker;
}
