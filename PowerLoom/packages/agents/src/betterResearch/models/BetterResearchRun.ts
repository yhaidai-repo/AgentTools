import type { RepoRef } from "@agenttools/runtime";
import type { ReadLog } from "../../evidence/ReadLog";
import type { ResearchContext } from "../../research/models/ResearchContext";
import type { BetterResearchDraft } from "./BetterResearchDraft";

// State one Better Research run builds up while preparing and running; read again when committing.
export interface BetterResearchRun {
  research: ResearchContext | null;
  commits: Record<string, string>;
  /** Repos actually taken from the cache; only these are released. */
  acquired: RepoRef[];
  readLog: ReadLog | null;
  draft: BetterResearchDraft;
}
