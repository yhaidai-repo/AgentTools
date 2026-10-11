import type { RecordClosing } from "./RecordClosing";

// What the vault-review agent decided about one open register record (WWW, KI, OQ); applied when the run succeeds.
export interface RecordDecision {
  vault: string;
  /** The register note, relative to the vault root. */
  path: string;
  recordId: string;
  action: "keep" | "close";
  /** Keep: why it stays open. Close: the one-line decision written into the record. */
  reasons: string;
  /** Close only. */
  closing: RecordClosing | null;
}
