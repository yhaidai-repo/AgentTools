import type { RunSessionKind } from "./RunSessionKind";
import type { RunSessionStatus } from "./RunSessionStatus";
import type { RunSessionUsage } from "./RunSessionUsage";

/** One session of a run read from its trace: the main session, or a sub-session hung under the call that started it. */
export interface RunSession {
  id: string;
  /** The session that made the starting call; null for the main session. */
  parentId: string | null;
  /** The parent's tool call that started the session (a sub-session's id is that call's id); null for the main session. */
  callId: string | null;
  kind: RunSessionKind;
  /** The sub-agent's type (`gsd-planner`); null for the main session and a background task. */
  name: string | null;
  description: string;
  background: boolean | null;
  /** 0 for the main session, 1 for its sub-sessions, and so on. */
  depth: number;
  startedAt: Date | null;
  endedAt: Date | null;
  status: RunSessionStatus;
  /** What the session said it did when it ended. */
  summary: string | null;
  usage: RunSessionUsage;
  eventCount: number;
}
