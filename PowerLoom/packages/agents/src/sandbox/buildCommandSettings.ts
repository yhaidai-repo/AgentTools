import { readRepoCommandSettings } from "@powerloom/core";
import type { PowerLoomDb } from "@powerloom/db";

/** Every build and test command the vault configured (vault setting `repoCommands`, the implementation agent's GSD
 *  build_command and test_command), whatever the repo: a shell command equal to one of them is a build or test the
 *  run's sandbox runs. */
export async function readBuildCommands(db: PowerLoomDb, vault: string): Promise<string[]> {
  const settings = await readRepoCommandSettings(db, vault);
  const commands = Object.values(settings.repos).flatMap((repo) => [repo.build, repo.test]);

  return commands.filter((command): command is string => typeof command === "string" && command.trim().length > 0);
}
