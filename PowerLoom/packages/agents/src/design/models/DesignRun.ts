import type { AgentToolset } from "../../toolset/AgentToolset";
import type { RepoAccess } from "../../models/RepoAccess";
import type { ResearchContext } from "../../research/models/ResearchContext";
import type { DesignDraft } from "./DesignDraft";

// State one design run builds up while preparing and running; read again when committing.
export interface DesignRun {
  context: ResearchContext | null;
  /** The repos it took from the cache; released when the run ends. */
  repos: RepoAccess;
  draft: DesignDraft;
  /** The shared tools of the run (its Config's); null until prepared. */
  toolset: AgentToolset | null;
}
