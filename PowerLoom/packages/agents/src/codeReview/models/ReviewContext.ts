import type { pullRequest, reviewComment } from "@powerloom/db";
import type { RepoRef } from "@agenttools/runtime";
import type { LinkedPbi } from "./LinkedPbi";

// What one review run is about: the pull request, its repo in the catalog, the comments earlier runs made and the PBIs the PR links.
export interface ReviewContext {
  pr: typeof pullRequest.$inferSelect;
  repo: RepoRef;
  earlierComments: (typeof reviewComment.$inferSelect)[];
  linkedPbis: LinkedPbi[];
}
