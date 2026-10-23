import type { agentRun } from "@powerloom/db";

// One agent run as the run table holds it (tokens, cost and trace live in AgentUsage, keyed by its id).
export type AgentRunRow = typeof agentRun.$inferSelect;
