import type { EventBase } from "./EventBase";
import type { SessionKind } from "./SessionKind";

// A sub-session opened inside the run. Its id is the call id of the tool call that started it, so the trace can hang
// it under that call; its own events carry the same `sessionId`.
export interface SessionStartEvent extends EventBase {
  type: "session_start";
  sessionId: string;
  /** The session that made the starting call; null for the run's main session. */
  parentSessionId: string | null;
  kind: SessionKind;
  /** The sub-agent's type (`gsd-planner`); null for a background task. */
  name: string | null;
  description: string;
  /** The provider's id of the task; tool policies see it as `ToolPolicyCall.taskId`. */
  taskId: string;
  /** True when the starting call returned at once and the session works on beside the main session. */
  background: boolean;
}
