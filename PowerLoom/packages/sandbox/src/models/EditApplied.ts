export interface EditApplied {
  /** How many matches were replaced. */
  count: number;
  /** The first and last line of the first replacement in the new file, 1-based. */
  lines: [number, number];
}
