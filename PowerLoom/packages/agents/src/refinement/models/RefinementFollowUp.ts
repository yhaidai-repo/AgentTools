// What a refinement run handed on: the user's questions and tasks, the agent tasks it created on the PBI (research), and
// whether it queued design. `taskId`: the run's own refinement task, still open while the run commits.
export interface RefinementFollowUp {
  pbiId: number;
  runId: number;
  taskId: string | null;
  userItemIds: string[];
  agentItemIds: string[];
  designQueued: boolean;
}
