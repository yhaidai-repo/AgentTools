// One agent task for the agent-runner to execute; the dispatcher already validated and claimed it.
export interface AgentRunJob {
  taskId: string;
  agentId: string;
  /** The task's PBI, whose notes the runner publishes after the run; null for tasks without one. */
  pbiId: number | null;
}
