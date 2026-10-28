export interface EventBase {
  runId: string;
  seq: number;
  at: Date;
  /** The sub-session the event belongs to (SessionStartEvent); absent for the run's main session. */
  sessionId?: string;
}
