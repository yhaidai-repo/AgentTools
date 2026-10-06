import type { MaintenanceRecord, ScannedNote, WikiLink } from "@adoa/vault";

// What one vault offers the vault-review agent: stale notes, notes nothing links to, links to no file, and the open
// records of its registers (WWW, KI, OQ).
export interface VaultReviewCandidates {
  stale: ScannedNote[];
  unlinked: ScannedNote[];
  deadLinks: WikiLink[];
  records: MaintenanceRecord[];
}
