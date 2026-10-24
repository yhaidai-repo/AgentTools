import { readDevHubSettings, readVaults } from "@powerloom/core";
import type { PowerLoomDb } from "@powerloom/db";
import { DevHubClient } from "@powerloom/devhub";

// Every DevHub a vault points at, once each (vaults may share one): where a restarted runner or MCP server sweeps the
// stacks and browser cases it left behind.
export async function devHubsOfVaults(db: PowerLoomDb): Promise<DevHubClient[]> {
  const settings = await Promise.all((await readVaults(db)).map((vault) => readDevHubSettings(db, vault.name)));
  const devHubs = new Map(settings.filter((stack) => stack.enabled && stack.token).map((stack) => [`${stack.url} ${stack.token}`, stack]));

  return [...devHubs.values()].map((stack) => new DevHubClient(stack.url, stack.token));
}
