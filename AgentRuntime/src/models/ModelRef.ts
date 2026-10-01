export interface ModelRef {
  /** Adapter key, e.g. "anthropic". */
  provider: string;
  /** Provider model id, e.g. "claude-sonnet-5". */
  model: string;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
}
