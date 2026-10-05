import type { ScannedNote, WikiLink } from "@adoa/vault";

// What one vault offers the vault-review agent: stale notes, notes nothing links to, and links to no file.
export interface VaultReviewCandidates {
  stale: ScannedNote[];
  unlinked: ScannedNote[];
  deadLinks: WikiLink[];
}
