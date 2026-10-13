import type { PullRequestCheckout } from "@agenttools/runtime";
import type { RepoAccess } from "../../models/RepoAccess";
import type { DiffScope } from "./DiffScope";
import type { ReviewContext } from "./ReviewContext";
import type { ReviewDraft } from "./ReviewDraft";

// One code-review run's state: filled while preparing, read by the tools and the commit, cleaned up at the end.
export interface ReviewRun {
  context: ReviewContext | null;
  checkout: PullRequestCheckout | null;
  scope: DiffScope;
  /** Earlier comments whose code changed since their commit; marked outdated when the run succeeds. */
  outdatedIds: string[];
  /** The PR's repo, taken from the cache; released when the run ends. */
  repos: RepoAccess;
  draft: ReviewDraft;
}
