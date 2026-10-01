export interface RepoCacheOptions {
  /** Folder holding one checkout per repo. */
  root: string;
  /** Extra HTTP header for git (e.g. "Authorization: Basic …"); passed per command, never stored. */
  authHeader?: string;
  /** Minimum minutes between fetches of one repo, unless a caller of acquire() passes its own. */
  refreshMinutes: number;
  /** Kill a git command after this long; default 15. */
  gitTimeoutMinutes?: number;
}
