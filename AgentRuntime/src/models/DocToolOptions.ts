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
  /** Told about every doc the agent used (paths relative to root): read_doc → read, each file search_docs matched → search.
   *  For usage tracking; a failure here never fails the tool. */
  onUse?: (paths: string[], kind: "read" | "search") => Promise<void>;
}
