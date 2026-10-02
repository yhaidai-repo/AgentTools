// What an upload belongs to: always a PBI, optionally the item it answers and the linked document it replaces.
export interface AttachmentTarget {
  adoId: number;
  itemId: string | null;
  sourceUrl: string | null;
  /** Who stored it: the user (default) or the worker fetching a linked document. */
  origin?: "upload" | "ado" | "confluence";
  /** The linked page's version when fetched (Confluence). */
  sourceVersion?: number | null;
}
