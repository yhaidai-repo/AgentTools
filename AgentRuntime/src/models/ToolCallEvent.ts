import type { EventBase } from "./EventBase";

export interface ToolCallEvent extends EventBase {
  type: "tool_call";
  callId: string;
  name: string;
  input: unknown;
}
