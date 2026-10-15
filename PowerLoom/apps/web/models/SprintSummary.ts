// One sprint as its snapshots describe it: the last snapshot day's counts, plus how long it was snapshotted.
export interface SprintSummary {
  iterationPath: string;
  firstDay: string;
  lastDay: string;
  days: number;
  items: number;
  done: number;
  /** The sum of the user's Tasks' Original Estimate in the sprint; null when none carries any. */
  effort: number | null;
}
