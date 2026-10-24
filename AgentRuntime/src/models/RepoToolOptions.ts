import type { RepoRefReader } from "./RepoRefReader";

export interface RepoToolOptions {
  /** Cache root with one checkout per repo. */
  root: string;
  /** Repos (folder names) this agent may see; read on every call, so a repo added during the run is seen. */
  repos: string[];
  /** Given: the tools take a `ref` (branch or commit) and list_branches / git_diff are added. */
  refs?: RepoRefReader;
  maxReadLines?: number;
  maxSearchResults?: number;
}
