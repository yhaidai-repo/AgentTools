// What an upload belongs to: always a PBI, optionally the item it answers and the linked document it replaces.
export interface AttachmentTarget {
  adoId: number;
  itemId: string | null;
  sourceUrl: string | null;
  /** Who stored it: the user (default), the worker fetching a linked document, or an agent's notes on a web page. */
  origin?: "upload" | "ado" | "confluence" | "agent";
  /** The linked page's version when fetched (Confluence). */
  sourceVersion?: number | null;
}
