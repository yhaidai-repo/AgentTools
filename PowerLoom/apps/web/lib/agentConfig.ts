import { PostgresAgentConfigStore } from "@agenttools/config";
import { getPool } from "./db";

// The web UI is one client of AgentConfig; the agent-runner applies saved changes by itself.
export function getAgentConfig(): PostgresAgentConfigStore {
  return new PostgresAgentConfigStore(getPool());
}
