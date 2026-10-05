// What a review run changes in one vault: notes rewritten (link fixes, `status: needs-review`) and notes removed.
export interface VaultChanges {
  /** Path → the note's new content. */
  edits: Map<string, string>;
  removed: string[];
}
