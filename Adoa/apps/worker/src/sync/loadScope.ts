import { resolveSprint, sprintScopeQuery, type AdoClient, type AdoIteration } from "@adoa/ado";
import type { AdoSettings, SyncSettings } from "@adoa/core";
import type { SprintRef } from "./models/SprintRef";
import type { SyncScope } from "./models/SyncScope";

// Scope = PBIs/bugs of one sprint in the chosen ADO states; null when the sprint can't be found.
export async function loadScope(client: AdoClient, ado: AdoSettings, sync: SyncSettings): Promise<SyncScope | null> {
  const iteration = await resolveSprint(client, sync.sprint);

  if (!iteration) {
    return null;
  }

  const ids = await client.queryIds(sprintScopeQuery(ado.project, iteration.path, sync.states, ado.user));

  return { allIds: ids.sort((a, b) => a - b), sprints: [toSprintRef(iteration)] };
}

function toSprintRef(iteration: AdoIteration): SprintRef {
  return {
    path: iteration.path,
    name: iteration.name,
    timeframe: iteration.timeFrame ?? "future",
    startDate: iteration.startDate,
    finishDate: iteration.finishDate,
  };
}
