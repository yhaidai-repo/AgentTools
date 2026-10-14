import type { AgentToolset } from "../../toolset/AgentToolset";
import type { RepoAccess } from "../../models/RepoAccess";
import type { ResearchContext } from "../../research/models/ResearchContext";
import type { BetterResearchDraft } from "./BetterResearchDraft";

// State one Better Research run builds up while preparing and running; read again when committing.
export interface BetterResearchRun {
  research: ResearchContext | null;
  /** The repos it took from the cache; released when the run ends. */
  repos: RepoAccess;
  draft: BetterResearchDraft;
  /** The shared tools of the run (its Config's); null until prepared. */
  toolset: AgentToolset | null;
}
