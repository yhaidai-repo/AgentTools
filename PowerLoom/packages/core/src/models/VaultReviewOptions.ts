// The vault-review agent's options (its Config) that decide which notes and records are candidates.
export interface VaultReviewOptions {
  /** The review period (user decision 2026-10-06: one period for both): a note unused this long is stale, and a decided
   *  note or kept record stays out of the lists this long, unless it changes. */
  staleDays: number;
  now: Date;
}
