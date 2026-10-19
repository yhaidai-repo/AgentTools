import type { StoredTraceEvent } from "@agenttools/usage";

// One line of a run's trace: an event, or a run of phase events folded into one.
export type TraceLine =
  | { kind: "event"; key: string; event: StoredTraceEvent }
  | { kind: "phases"; key: string; events: StoredTraceEvent[] };
