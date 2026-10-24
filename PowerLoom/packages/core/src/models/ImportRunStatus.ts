import type { ImportSourceStatus } from "./ImportSourceStatus";

// The pbi-import job's last look at its sources; saved because the web can't see the import inbox folder.
export interface ImportRunStatus {
  /** False when IMPORT_INBOX_ROOT isn't set for the worker. */
  configured: boolean;
  checkedAt: string;
  sources: ImportSourceStatus[];
}
