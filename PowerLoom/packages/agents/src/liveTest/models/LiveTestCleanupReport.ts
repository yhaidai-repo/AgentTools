/** The cleanup phase of a live-test run's trace: what was removed and what is left over, with why. */
export interface LiveTestCleanupReport {
  removed: string[];
  failed: string[];
}
