// One link the vault-review agent repoints (or turns into plain text when `to` is null); applied when the run succeeds.
export interface LinkFix {
  vault: string;
  /** The note holding the link, relative to the vault root. */
  path: string;
  /** The link target as written, e.g. `old-note`. */
  target: string;
  to: string | null;
  reason: string;
}
