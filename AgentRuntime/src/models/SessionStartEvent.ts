import type { EventBase } from "./EventBase";
import type { SessionKind } from "./SessionKind";

// A sub-session opened inside the run. Its id is the call id of the tool call that started it, so the trace can hang
// it under that call; its own events carry the same `sessionId`. A session whose first frame came before its start
// message opens `inferred`, from what that frame told; the later, complete session_start of the same id replaces it.
export interface SessionStartEvent extends EventBase {
  type: "session_start";
  sessionId: string;
  /** The session that made the starting call; null for the run's main session. */
  parentSessionId: string | null;
  kind: SessionKind;
  /** The sub-agent's type (`gsd-planner`); null for a background task. */
  name: string | null;
  description: string;
  /** The provider's id of the task, as tool policies see it (`ToolPolicyCall.taskId`); null while inferred. */
  taskId: string | null;
  /** True when the starting call returned at once and the session works on beside the main session; null while inferred. */
  background: boolean | null;
  inferred: boolean;
}
