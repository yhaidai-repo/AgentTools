import type { ImportSourceStatus } from "@adoa/core";
import type { PendingImport } from "./PendingImport";

// One way PBIs come into adoa (user decision 2026-10-02): the pbi-import job reads every source through this, so a new
// source needs no change to the job or to importPbis.
export interface PbiImportSource {
  /** Also the request's `source`, shown in the Imports panel. */
  readonly id: string;
  /** Waiting items, oldest first, at most `limit`. */
  readPending(limit: number): Promise<PendingImport[]>;
  status(): Promise<ImportSourceStatus>;
}
