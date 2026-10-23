// How a note was used in the chosen period (counts) and when it was last used at all (any period).
export interface NoteUsage {
  path: string;
  title: string;
  reads: number;
  searches: number;
  /** Named in a shell command (Claude Code's usual way to read a note; sometimes only a mention). */
  shell: number;
  writes: number;
  agents: string[];
  /** Last read, search or shell use in the whole log; null = never. */
  lastUsed: Date | null;
}
