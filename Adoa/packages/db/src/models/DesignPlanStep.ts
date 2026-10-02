// One ordered step of a design's implementation plan.
export interface DesignPlanStep {
  step: string;
  repo: string;
  /** Files and symbols the step changes, e.g. "src/Orders/OrderService.cs: OrderService.Cancel". */
  locations: string[];
  change: string;
  /** Whether an agent can implement the step without a person. */
  agentDoable: boolean;
}
