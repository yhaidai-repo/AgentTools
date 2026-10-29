import type { BuildCommands } from "@powerloom/db";

// One catalogue repo's saved build and test commands (repo_saveCommands' answer).
export interface RepoBuildCommands extends BuildCommands {
  repo: string;
}
