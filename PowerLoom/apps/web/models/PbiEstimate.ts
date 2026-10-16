// A finished PBI's estimates against the effort the user gave when finishing it, all in hours. An estimate is null when
// its source has none for the PBI.
export interface PbiEstimate {
  pbiId: number;
  title: string;
  /** The user's Tasks' Original Estimate in ADO, from the PBI's latest sprint snapshot. */
  originalHours: number | null;
  /** The latest refinement's rough estimate. */
  refinementHours: number | null;
  /** The latest design's estimate for a developer without an agent. */
  designHours: number | null;
  /** The user's own time on the PBI, from its latest finish. */
  actualHours: number;
  finishedAt: Date;
}
