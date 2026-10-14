import type { AgentIntegrationSpec } from "@agenttools/config";

// Read Azure (user decisions 2026-10-12/14): one switch per kind on each agent, off by default. Azure access = the
// Azure MCP server's read tools; Cosmos DB and Mongo keep an allow-list of accounts in Settings.
export const AZURE_ACCESS_INTEGRATION = "azureAccess";
export const READ_COSMOS_INTEGRATION = "readCosmos";
export const READ_MONGO_INTEGRATION = "readMongo";

export const AZURE_INTEGRATION_SPECS: AgentIntegrationSpec[] = [
  {
    key: AZURE_ACCESS_INTEGRATION,
    label: "Azure access (read)",
    description: "The agent may read Azure with the vault's sign-in (Settings → Read Azure) through Microsoft's Azure MCP Server, read-only: App Insights and Log Analytics queries, metrics and activity logs, Service Bus queue and topic counts and peeked messages, resource groups and subscriptions. It sees what the signed-in account sees.",
  },
  {
    key: READ_COSMOS_INTEGRATION,
    label: "Read Azure: Cosmos DB",
    description: "The agent may list and query the vault's enabled Cosmos DB accounts (Settings → Read Azure → Cosmos DB) with the sign-in's read-only keys.",
  },
  {
    key: READ_MONGO_INTEGRATION,
    label: "Read Azure: Mongo",
    description: "The agent may list, find and aggregate documents in the vault's enabled Cosmos DB for MongoDB accounts (Settings → Read Azure → Mongo), read-only, with the read-only connection string the sign-in fetches at call time.",
  },
];

// Every switch off: what each agent's defaults spread into its capabilities.
export const AZURE_INTEGRATIONS: Record<string, boolean> = Object.fromEntries(AZURE_INTEGRATION_SPECS.map((spec) => [spec.key, false]));
