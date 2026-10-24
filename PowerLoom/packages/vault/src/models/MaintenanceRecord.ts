import type { RegisterKind } from "./RegisterKind";

// One record of a maintenance register (WWW, KI, OQ) with its text, so it can be checked and closed in place.
export interface MaintenanceRecord {
  kind: RegisterKind;
  /** The register note, relative to the vault root. */
  path: string;
  id: string;
  title: string;
  /** Open, Resolved, Fixed…; empty when the record has no status. */
  status: string;
  isOpen: boolean;
  updated: string | null;
  /** From the record's heading to the next heading, without trailing blank lines. */
  text: string;
}
