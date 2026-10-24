import type { DataAccessCall } from "@powerloom/core";

export { ALL_ACCESS_AGENTS as ALL_AGENTS, configuredResources, dataAccessAgents as agentChoices, isResourceUsed as isUsed, latestCalls, loadDataAccess, resourceUsage } from "@powerloom/core";

// The Tools tab's name for a logged call (core's DataAccessCall; DataAccessRow in core is the row as written).
export type DataAccessRow = DataAccessCall;
