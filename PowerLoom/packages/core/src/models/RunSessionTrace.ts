import type { StoredTraceEvent } from "@agenttools/usage";
import type { RunSession } from "./RunSession";

/** A run's trace split by session: the sessions in tree order (main first, each followed by its own), and each one's events. */
export interface RunSessionTrace {
  sessions: RunSession[];
  events: Record<string, StoredTraceEvent[]>;
}
