// One item from an import source (a mail, a file, a future job's find): the PBIs it names, by id or by links in its
// content. Each import source turns its items into requests; the inbox source reads them as JSON files as they are.
export interface PbiImportRequest {
  /** Who sent it, e.g. "outlook"; shown in the Imports panel. */
  source: string;
  /** The item's id in the source (mail id, file name…); a re-sent item isn't imported twice. */
  sourceRef: string;
  title?: string;
  /** Who the item came from, e.g. a mail's sender. */
  from?: string;
  /** When the item happened in the source (ISO), e.g. a mail's received time. */
  occurredAt?: string;
  adoIds?: number[];
  /** Content whose ADO work item links name the PBIs. */
  html?: string;
  text?: string;
  /** Prepare the PBIs for refinement after the sync (default true). */
  prepare?: boolean;
}
