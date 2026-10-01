import type { RepoRef } from "@agenttools/runtime";
import type { ResearchContext } from "./ResearchContext";
import type { ResearchDraft } from "./ResearchDraft";

// State one research run builds up while preparing and running; read again when committing.
export interface ResearchRun {
  research: ResearchContext | null;
  commits: Record<string, string>;
  /** Repos actually taken from the cache; only these are released. */
  acquired: RepoRef[];
  draft: ResearchDraft;
}
