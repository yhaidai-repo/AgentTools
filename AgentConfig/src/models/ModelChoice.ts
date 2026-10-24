// Provider + model id; any value is allowed, the host decides which providers it can run.
export interface ModelChoice {
  provider: string;
  model: string;
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
}
