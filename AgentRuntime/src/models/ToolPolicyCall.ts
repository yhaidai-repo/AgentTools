// A tool call about to run, from the run's main session or from one of its sub-agents.
export interface ToolPolicyCall {
  callId: string;
  name: string;
  input: unknown;
  /** The calling sub-agent's task id (SessionStartEvent.taskId); null for the main session. */
  taskId: string | null;
  /** The calling sub-agent's type (`gsd-planner`); null for the main session. */
  agentType: string | null;
}
