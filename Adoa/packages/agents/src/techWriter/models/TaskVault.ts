import type { DocsVault } from "../../models/DocsVault";

// The vault one tech-writer task works in: the docs vault for drafts, the note's vault for actualize tasks.
export interface TaskVault {
  name: string;
  /** Where its files are read. */
  root: string;
  writer: DocsVault;
  isDocsVault: boolean;
}
