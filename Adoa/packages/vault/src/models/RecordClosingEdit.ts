// What closing a register record writes into it.
export interface RecordClosingEdit {
  /** The record's new status word: Fixed or Resolved (KI/OQ); a WWW record always becomes resolved. */
  status: string;
  /** Who decided and when, e.g. "adoa vault-review, 2026-10-06". */
  decidedBy: string;
  /** One line: what settled the record and where the vault says so. */
  decision: string;
}
