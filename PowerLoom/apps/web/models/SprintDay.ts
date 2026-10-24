// One snapshot day of a sprint: the items per ADO state, and the Original Estimate of the user's Tasks under them, in all
// and per state, when ADO carries it.
export interface SprintDay {
  /** YYYY-MM-DD. */
  day: string;
  itemsByState: Record<string, number>;
  /** Only the states whose items carry effort. */
  effortByState: Record<string, number>;
  effort: number | null;
}
