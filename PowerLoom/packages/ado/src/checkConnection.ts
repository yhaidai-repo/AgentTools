import { AdoClient } from "./AdoClient";
import type { AdoConnection } from "./models/AdoConnection";
import type { ConnectionCheck } from "./models/ConnectionCheck";
import { CURRENT_SPRINT, resolveSprint } from "./resolveSprint";
import { sprintScopeQuery } from "./wiql";

// Checks the PAT, project and team in one go, as the Settings page needs.
export async function checkConnection(connection: AdoConnection): Promise<ConnectionCheck> {
  const client = new AdoClient(connection);

  try {
    const current = await resolveSprint(client, CURRENT_SPRINT);

    if (!current) {
      return { ok: true, message: "Connected. The team has no current sprint." };
    }

    const ids = await client.queryIds(sprintScopeQuery(connection.project, current.path, [], ""));

    return { ok: true, message: `Connected. Current sprint ${current.name}: ${ids.length} PBIs/bugs in any state.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error) };
  }
}
