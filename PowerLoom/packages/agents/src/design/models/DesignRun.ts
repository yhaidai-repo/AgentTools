import type { RepoRef } from "@agenttools/runtime";
import type { ResearchContext } from "../../research/models/ResearchContext";
import type { DesignDraft } from "./DesignDraft";

// State one design run builds up while preparing and running; read again when committing.
export interface DesignRun {
  context: ResearchContext | null;
  commits: Record<string, string>;
  /** Repos actually taken from the cache; only these are released. */
  acquired: RepoRef[];
  draft: DesignDraft;
}
