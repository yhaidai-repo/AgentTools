import type { AgentToolset } from "../../toolset/AgentToolset";
import type { RepoAccess } from "../../models/RepoAccess";

// State one refinement run builds up while preparing; the repos are released when the run ends.
export interface RefinementRun {
  repos: RepoAccess;
  /** The shared tools of the run (its Config's); null until prepared. */
  toolset: AgentToolset | null;
}
