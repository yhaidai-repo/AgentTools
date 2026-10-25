// One `[[target#heading|label]]` link in a note (code blocks and inline code don't count).
export interface WikiLink {
  /** The linking note, relative to the vault root. */
  from: string;
  /** As written, without heading and label, e.g. `pos-index` or `pos/pos-index.md`. */
  target: string;
  heading: string | null;
  label: string | null;
  /** 1-based line number in the linking note. */
  line: number;
  /** The whole line, trimmed: the link's context. */
  text: string;
}
