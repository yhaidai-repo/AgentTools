import type { StoredTraceEvent } from "@agenttools/usage";
import type { RunSession } from "@powerloom/core/src/models/RunSession";
import type { TraceFilter } from "@/lib/traceLooks";

// What the nested trace draws from: the run's sessions, the events loaded so far (a session of a large trace loads when
// it is opened), and the pill that filters them.
export interface SessionTraceSource {
  sessions: RunSession[];
  events: Record<string, StoredTraceEvent[] | undefined>;
  filter: TraceFilter;
  load: (sessionId: string) => void;
}
