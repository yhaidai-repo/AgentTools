import type { Outcome, PbiImportRequest } from "@adoa/core";

// One item an import source has waiting. The job imports it, then tells the source how it went.
export interface PendingImport {
  /** For logs, e.g. the file name. */
  label: string;
  /** The item as a request, or why it can't be one. */
  request: Outcome<PbiImportRequest>;
  /** Imported: the source drops the item (e.g. deletes the file). */
  complete(): Promise<void>;
  /** Unusable: the source sets it aside with the reason (e.g. failed/ plus a .reason.txt). */
  reject(reason: string): Promise<void>;
}
