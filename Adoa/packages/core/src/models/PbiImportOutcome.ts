import type { PbiImportResult } from "@adoa/db";

export interface PbiImportOutcome {
  importId: number;
  results: PbiImportResult[];
  /** True when the item was imported before without failures, so nothing was done now. */
  repeated: boolean;
}
