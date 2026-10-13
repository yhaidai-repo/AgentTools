// What one run may still create for agents; tasks for the user are never capped.
export interface TaskCreationLimits {
  /** The creating task's depth; tasks it creates get depth + 1. */
  depth: number;
  maxDepth: number;
  maxPerRun: number;
  maxPerPbi: number;
  /** Agent tasks agents already created on the PBI, before this run. */
  createdOnPbi: number;
}
