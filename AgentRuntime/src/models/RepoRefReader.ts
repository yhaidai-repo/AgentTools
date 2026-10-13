import type { ResolvedRef } from "./ResolvedRef";

// Reads branches and commits of a cached repo other than its checkout (the repo tools' `ref`); repos by folder name.
export interface RepoRefReader {
  listBranches(repo: string, filter: string): Promise<string[]>;
  resolve(repo: string, ref: string): Promise<ResolvedRef>;
  /** Entries of a folder at a commit; folders end with '/'. */
  listTree(repo: string, commit: string, path: string): Promise<string[]>;
  show(repo: string, commit: string, path: string): Promise<string>;
  /** `<path>:<line>: text` matches at a commit. */
  grep(repo: string, commit: string, query: string, glob?: string): Promise<string[]>;
  log(repo: string, commit: string, path: string, limit: number): Promise<string>;
  diff(repo: string, base: string, head: string, path?: string): Promise<string>;
}
