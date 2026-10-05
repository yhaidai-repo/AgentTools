// The vault-review agent's options (its Config) that decide which notes are candidates.
export interface VaultReviewOptions {
  /** A note unused this long is stale; a note changed within this time isn't offered yet. */
  staleDays: number;
  /** A decided note stays out of the lists this long, unless it changes. */
  recheckDays: number;
  now: Date;
}
