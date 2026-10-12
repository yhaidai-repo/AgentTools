import type { AgentIntegrationSpec } from "@agenttools/config";

// Read Azure (user decision 2026-10-12): one switch per resource kind on each agent, off by default. The tools behind
// them arrive kind by kind (App Insights and Cosmos first).
export const READ_AZURE_LOGS_INTEGRATION = "readAzureLogs";
export const READ_COSMOS_INTEGRATION = "readCosmos";
export const READ_SERVICE_BUS_INTEGRATION = "readServiceBus";
export const READ_MONGO_INTEGRATION = "readMongo";

export const AZURE_INTEGRATION_SPECS: AgentIntegrationSpec[] = [
  {
    key: READ_AZURE_LOGS_INTEGRATION,
    label: "Read Azure: App Insights logs",
    description: "The agent may run KQL queries on the vault's App Insights / Log Analytics resources (Settings → Read Azure) during its runs.",
  },
  {
    key: READ_COSMOS_INTEGRATION,
    label: "Read Azure: Cosmos DB",
    description: "The agent may query documents in the vault's Cosmos DB accounts during its runs.",
  },
  {
    key: READ_SERVICE_BUS_INTEGRATION,
    label: "Read Azure: Service Bus",
    description: "The agent may read queue counts and peek messages in the vault's Service Bus namespaces during its runs. Peek only; nothing is received.",
  },
  {
    key: READ_MONGO_INTEGRATION,
    label: "Read Azure: Mongo",
    description: "The agent may find documents in the vault's Mongo resources during its runs.",
  },
];

// Every switch off: what each agent's defaults spread into its capabilities.
export const AZURE_INTEGRATIONS: Record<string, boolean> = Object.fromEntries(AZURE_INTEGRATION_SPECS.map((spec) => [spec.key, false]));
