import type { AgentToolset } from "../../toolset/AgentToolset";
import type { RepoAccess } from "../../models/RepoAccess";
import type { RunWriter } from "../../toolset/models/RunWriter";

// State one generic run builds up while preparing; read again when committing.
export interface GenericRun {
  /** The repos it took from the cache; released when the run ends. */
  repos: RepoAccess;
  /** The shared tools of the run (its Config's); null until prepared. */
  toolset: AgentToolset | null;
  /** The granted writers, built before the repos open; cleaned up when the run ends. */
  writers: RunWriter[];
}
