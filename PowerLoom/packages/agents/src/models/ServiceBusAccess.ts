import type { ServiceBusPeeker } from "@powerloom/azure";

// The run's Service Bus peeks, with each namespace's own connection string (the counts come from the Azure MCP server).
export interface ServiceBusAccess {
  peeker: ServiceBusPeeker;
}
