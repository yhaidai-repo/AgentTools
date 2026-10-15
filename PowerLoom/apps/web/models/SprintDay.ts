// One snapshot day of a sprint: the items per ADO state, the Original Estimate of the user's Tasks under them and the Remaining Work,
// when ADO carries them.
export interface SprintDay {
  /** YYYY-MM-DD. */
  day: string;
  itemsByState: Record<string, number>;
  effort: number | null;
  remainingWork: number | null;
}
