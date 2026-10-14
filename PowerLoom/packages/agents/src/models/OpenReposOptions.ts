// How a run opens its repos beyond the sources attached to its task.
export interface OpenReposOptions {
  /** The vault whose catalog open_repo offers when no source names one (a task with nothing attached). */
  vault?: string;
  /** A root of the run's own checkouts instead of the cache (code review's PR checkout); no open_repo there. */
  toolsRoot?: string;
}
