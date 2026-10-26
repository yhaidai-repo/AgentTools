// A Codex thread's running token totals, as its rollout's token_count entries keep them (total_token_usage).
export interface CodexTokenTotals {
  input: number;
  cachedInput: number;
  output: number;
}
