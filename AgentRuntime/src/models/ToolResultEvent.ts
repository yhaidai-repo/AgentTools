import type { EventBase } from "./EventBase";

export interface ToolResultEvent extends EventBase {
  type: "tool_result";
  callId: string;
  isError: boolean;
  output: string;
}
