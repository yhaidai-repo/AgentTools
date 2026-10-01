import type { EventBase } from "./EventBase";

// Tokens of one model turn; matches AgentUsage's UsageEvent shape structurally.
export interface TurnUsageEvent extends EventBase {
  type: "usage";
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}
