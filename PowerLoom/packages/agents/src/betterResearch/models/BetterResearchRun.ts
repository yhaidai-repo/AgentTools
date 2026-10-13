import type { ReadLog } from "../../evidence/ReadLog";
import type { RepoAccess } from "../../models/RepoAccess";
import type { ResearchContext } from "../../research/models/ResearchContext";
import type { BetterResearchDraft } from "./BetterResearchDraft";

// State one Better Research run builds up while preparing and running; read again when committing.
export interface BetterResearchRun {
  research: ResearchContext | null;
  /** The repos it took from the cache; released when the run ends. */
  repos: RepoAccess;
  readLog: ReadLog | null;
  draft: BetterResearchDraft;
}
