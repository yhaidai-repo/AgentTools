import type { DataAccessCall } from "@powerloom/core";
import { ALL_ACCESS_AGENTS, type ToolCatalogRow } from "@powerloom/core";

export { ALL_ACCESS_AGENTS as ALL_AGENTS, configuredResources, dataAccessAgents as agentChoices, isResourceUsed as isUsed, latestCalls, latestToolCalls, loadDataAccess, readToolOffers, resourceUsage, toolCatalog } from "@powerloom/core";
export type { ToolCatalogRow } from "@powerloom/core";

// The Tools tab's name for a logged call (core's DataAccessCall; DataAccessRow in core is the row as written).
export type DataAccessRow = DataAccessCall;

// With one agent chosen: the tools it has, and any other tool it called in the period.
export function toolsOfAgent(rows: ToolCatalogRow[], agent: string): ToolCatalogRow[] {
  return agent === ALL_ACCESS_AGENTS ? rows : rows.filter((row) => row.holders.includes(agent) || row.calls > 0);
}
