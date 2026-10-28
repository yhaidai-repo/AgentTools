import type { EventBase } from "./EventBase";

// Running totals of a sub-session. Its tokens are a count only: costs come from the per-model usage events.
export interface SessionProgressEvent extends EventBase {
  type: "session_progress";
  sessionId: string;
  totalTokens: number;
  toolUses: number;
  durationMs: number;
  lastToolName: string | null;
}
