import type { BuildCommands } from "@powerloom/db";

// The build and test commands of a vault's repos (vault setting `repoCommands`), keyed by the repo's name as the repo
// catalogue lists it: what the implementation agent's GSD runs as workflow.build_command and workflow.test_command.
export interface RepoCommandSettings {
  repos: Record<string, Partial<BuildCommands>>;
}
