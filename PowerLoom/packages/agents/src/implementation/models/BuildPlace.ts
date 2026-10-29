import type { BuildCommands } from "@powerloom/db";

// Where the build happened: the repo, the PBI branch and its base, the run's worktree, the plan version it executed and
// the repo's configured commands.
export interface BuildPlace {
  repo: string;
  branch: string;
  baseBranch: string;
  worktree: string;
  planVersion: number;
  commands: BuildCommands;
}
