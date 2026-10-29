import { readValue, vaultSettingKey } from "@powerloom/core";
import type { PowerLoomDb } from "@powerloom/db";
import type { RepoBuildCommands } from "./models/RepoBuildCommands";

// The vault setting the implementation agent's GSD takes its build_command and test_command from.
export const REPO_COMMANDS_KEY = "repoCommands";

/** Every build and test command the vault configured, whatever the repo: a shell command equal to one of them is a
 *  build or test the run's sandbox runs. */
export async function readBuildCommands(db: PowerLoomDb, vault: string): Promise<string[]> {
  const stored = await readValue<Partial<RepoBuildCommands>>(db, vaultSettingKey(vault, REPO_COMMANDS_KEY));
  const commands = Object.values(stored?.repos ?? {}).flatMap((repo) => [repo.build, repo.test]);

  return commands.filter((command): command is string => typeof command === "string" && command.trim().length > 0);
}
