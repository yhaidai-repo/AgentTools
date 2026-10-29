// A file the host writes into the worktree's .planning/ folder before the run: `path` is relative to that folder.
export interface GsdSeedFile {
  path: string;
  content: string;
}
