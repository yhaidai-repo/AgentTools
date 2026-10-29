import type { BuildCommit } from "@powerloom/db";
import type { PlanningFolder } from "../../planning/models/PlanningFolder";

// Where write_implementation reads the build from: the worktree's .planning/ folder and its git history.
export interface BuildSource {
  planning: PlanningFolder;
  /** The commits on the branch since the remote's `base`, oldest first. */
  commits(base: string): Promise<BuildCommit[]>;
  head(): Promise<string | null>;
}
