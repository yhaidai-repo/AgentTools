import { PostgresUsageStore } from "@agenttools/usage";
import { getPool } from "./db";

// Read side of AgentUsage; the agent-runner writes the records and traces.
export function getUsageStore(): PostgresUsageStore {
  return new PostgresUsageStore(getPool());
}
