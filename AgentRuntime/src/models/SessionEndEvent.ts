import type { EventBase } from "./EventBase";
import type { SessionEndStatus } from "./SessionEndStatus";

// A sub-session ended. Its tokens are a count only: costs come from the per-model usage events.
export interface SessionEndEvent extends EventBase {
  type: "session_end";
  sessionId: string;
  status: SessionEndStatus;
  summary: string | null;
  totalTokens: number | null;
  toolUses: number | null;
  durationMs: number | null;
}
