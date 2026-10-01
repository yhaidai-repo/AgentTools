// A dispatcher tick. With an agent id (its schedule, or "Run now"), that agent's open tasks are validated and started too.
export interface DispatchJob {
  agentId?: string;
}
