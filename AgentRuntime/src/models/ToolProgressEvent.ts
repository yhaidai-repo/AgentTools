import type { EventBase } from "./EventBase";

// A tool call still running.
export interface ToolProgressEvent extends EventBase {
  type: "tool_progress";
  callId: string;
  name: string;
  elapsedMs: number;
}
