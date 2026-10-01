export interface DocToolOptions {
  /** Read-only folder the tools may see; nothing outside it is reachable. */
  root: string;
  /** Folders (relative to root) the tools must not see, e.g. generated output. */
  exclude?: string[];
  /** Lines returned by one read_doc call. */
  maxReadLines?: number;
  maxSearchResults?: number;
  /** File extensions search_docs looks into. */
  searchExtensions?: string[];
}
