// A Markdown note of a vault as the vault review reads it.
export interface ScannedNote {
  /** Relative to the vault root, `/` separators. */
  path: string;
  /** The file name without `.md`: what `[[name]]` links use. */
  name: string;
  title: string;
  /** Last change on disk. */
  mtime: Date;
  content: string;
}
