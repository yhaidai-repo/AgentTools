import type { AgentToolset } from "../../toolset/AgentToolset";
import type { RepoAccess } from "../../models/RepoAccess";
import type { ResearchContext } from "./ResearchContext";
import type { ResearchDraft } from "./ResearchDraft";

// State one research run builds up while preparing and running; read again when committing.
export interface ResearchRun {
  research: ResearchContext | null;
  /** The repos it took from the cache; released when the run ends. */
  repos: RepoAccess;
  draft: ResearchDraft;
  /** The shared tools of the run (its Config's); null until prepared. */
  toolset: AgentToolset | null;
}
