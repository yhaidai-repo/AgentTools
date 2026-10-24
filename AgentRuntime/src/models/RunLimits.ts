// Hard limits enforced by the runtime itself; budgets are enforced from outside through the abort signal.
export interface RunLimits {
  maxTurns: number;
  timeoutMs: number;
}
