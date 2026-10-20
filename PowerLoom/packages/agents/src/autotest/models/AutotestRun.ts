import type { workItem } from "@powerloom/db";
import type { RepoAccess } from "../../models/RepoAccess";
import type { AgentToolset } from "../../toolset/AgentToolset";
import type { AutotestDraft } from "./AutotestDraft";

// State one Autotest run builds up while preparing and running; read again when committing.
export interface AutotestRun {
  pbi: typeof workItem.$inferSelect | null;
  /** The repos it took from the cache; released when the run ends. */
  repos: RepoAccess;
  draft: AutotestDraft;
  /** The shared tools of the run (its Config's); null until prepared. */
  toolset: AgentToolset | null;
}
