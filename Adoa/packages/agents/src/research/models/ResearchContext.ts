import type { localItem, workItem } from "@adoa/db";
import type { RepoRef } from "@agenttools/runtime";

// Everything one research run is about: the task, its PBI and the repos it may read.
export interface ResearchContext {
  task: typeof localItem.$inferSelect;
  pbi: typeof workItem.$inferSelect;
  repos: RepoRef[];
  /** Repo names from the refinement that the catalog doesn't know. */
  unknownRepos: string[];
}
