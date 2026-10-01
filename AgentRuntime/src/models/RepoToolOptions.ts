export interface RepoToolOptions {
  /** Cache root with one checkout per repo. */
  root: string;
  /** Repos (folder names) this agent may see. */
  repos: string[];
  maxReadLines?: number;
  maxSearchResults?: number;
}
