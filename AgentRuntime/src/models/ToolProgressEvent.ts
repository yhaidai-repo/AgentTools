import type { EventBase } from "./EventBase";

// A tool call still running.
export interface ToolProgressEvent extends EventBase {
  type: "tool_progress";
  callId: string;
  name: string;
  elapsedMs: number;
  /** What the tool itself reported (ToolCallContext.progress); absent on the provider's own heartbeat. */
  detail?: string;
}
