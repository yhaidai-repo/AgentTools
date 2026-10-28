import type { StoredTraceEvent } from "@agenttools/usage";

// The run's main session has no id in the trace: its events carry no sessionId.
export const MAIN_SESSION_ID = "main";

export function sessionIdOf(event: StoredTraceEvent): string {
  const id = event.payload.sessionId;

  return typeof id === "string" && id !== "" ? id : MAIN_SESSION_ID;
}
