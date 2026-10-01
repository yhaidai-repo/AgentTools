// One model turn's tokens. Any runtime can produce this shape; AgentRuntime's usage event matches it.
export interface UsageEvent {
  runId: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheWriteTokens: number;
}
