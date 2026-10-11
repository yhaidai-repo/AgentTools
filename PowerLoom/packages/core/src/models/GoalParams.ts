// A scheduled task's parameters for an agent without a producer: what to do, and on which of the vault's repositories.
export interface GoalParams {
  goal: string;
  repos: string[];
}
