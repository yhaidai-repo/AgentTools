// One snapshot day of a sprint: the items per ADO state, and the effort fields when ADO carries them.
export interface SprintDay {
  /** YYYY-MM-DD. */
  day: string;
  itemsByState: Record<string, number>;
  effort: number | null;
  remainingWork: number | null;
}
