import type { RepoAccess } from "../../models/RepoAccess";

// State one goal run builds up while preparing; the repos are released when the run ends.
export interface GoalRun {
  repos: RepoAccess;
}
