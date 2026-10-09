import { FIELD, resolveSprint, sprintTasksQuery, type AdoClient, type AdoIteration, type AdoWorkItem } from "@adoa/ado";
import { isMarkedBug, type AdoSettings, type SyncSettings } from "@adoa/core";
import type { SprintRef } from "./models/SprintRef";
import type { SyncScope } from "./models/SyncScope";

const TASK_FIELDS = [FIELD.type, FIELD.title, FIELD.parent];

// Scope = the user's Tasks in one sprint, in any state (user decision 2026-10-09): their parents are the PBIs to pull,
// whoever owns them and whatever their state, and the [BUG] Tasks among them are the bugs. Null when the sprint can't
// be found.
export async function loadScope(client: AdoClient, ado: AdoSettings, sync: SyncSettings): Promise<SyncScope | null> {
  const iteration = await resolveSprint(client, sync.sprint);

  if (!iteration) {
    return null;
  }

  const taskIds = await client.queryIds(sprintTasksQuery(ado.project, iteration.path, ado.user));
  const tasks = await client.getWorkItems(taskIds, TASK_FIELDS);

  return { allIds: parentIds(tasks), bugIds: bugIds(tasks), sprints: [toSprintRef(iteration)] };
}

function parentIds(tasks: AdoWorkItem[]): number[] {
  const ids = tasks.map((task) => task.fields[FIELD.parent]).filter((id): id is number => typeof id === "number");

  return [...new Set(ids)].sort((a, b) => a - b);
}

function bugIds(tasks: AdoWorkItem[]): number[] {
  return tasks.filter((task) => isMarkedBug(String(task.fields[FIELD.type]), String(task.fields[FIELD.title]))).map((task) => task.id);
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
