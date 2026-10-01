// One note in the docs vault's draft/ folder, as VaultCapture `drafts` lists it.
export interface VaultDraft {
  name: string;
  title: string;
  project: string;
  captured: string;
  source: string;
  target: string;
  /** Path inside the container. */
  path: string;
  /** Its source starts with the preferred prefix (adoa's own drafts). */
  preferred: boolean;
}
