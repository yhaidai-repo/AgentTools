// A session's totals: its session_end's, else its last session_progress's. Tokens are a count only (costs are per model,
// for the whole run); null when the trace never told.
export interface RunSessionUsage {
  totalTokens: number | null;
  toolUses: number | null;
  durationMs: number | null;
}
