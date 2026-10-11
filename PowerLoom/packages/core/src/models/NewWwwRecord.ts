import type { WwwEntry } from "@powerloom/vault";

// A WWW record to log: the entry, the vault folder whose www-log.md takes it, and what created it.
export interface NewWwwRecord extends WwwEntry {
  vault: string;
  source: string;
}
