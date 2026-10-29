// What a running tool call may do besides answering: tell the run's trace how a long call is getting on.
export interface ToolCallContext {
  /** A short status of the call (a restore's step, its time left); the trace shows it as a `tool_progress` event. */
  progress(detail: string): void;
}
