// A finished PBI's estimates against the effort the user gave when finishing it, all in hours. An estimate is null when
// its source has none for the PBI.
export interface PbiEstimate {
  pbiId: number;
  title: string;
  /** The user's Tasks' Original Estimate in ADO, from the PBI's latest sprint snapshot. */
  originalHours: number | null;
  /** The latest agent estimate (any agent): a developer without an agent. */
  humanHours: number | null;
  /** The same estimate: an agent implementing it; null also for a refinement estimate from before it gave one. */
  agentHours: number | null;
  /** The agent that gave the latest estimate. */
  estimatedBy: string | null;
  /** The user's own time on the PBI, from its latest finish. */
  actualHours: number;
  finishedAt: Date;
}
