// Vault content that shows a record is settled: a note of the same vault and its exact words.
export interface RecordEvidence {
  /** Relative to the vault root. */
  path: string;
  quote: string;
}
