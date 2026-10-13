import type { RepoAccess } from "../../models/RepoAccess";
import type { VaultReviewDraft } from "./VaultReviewDraft";

// State one vault-review run builds up while preparing and running; the repos are released when the run ends.
export interface VaultReviewRun {
  repos: RepoAccess;
  draft: VaultReviewDraft;
}
