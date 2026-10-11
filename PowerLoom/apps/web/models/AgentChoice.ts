// An agent the schedule form offers.
export interface AgentChoice {
  id: string;
  label: string;
  /** False for an agent with its own task producer (the vault review): no goal or repos to enter. */
  takesGoal: boolean;
}
