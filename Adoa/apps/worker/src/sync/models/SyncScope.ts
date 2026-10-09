import type { SprintRef } from "./SprintRef";

// What one sync pulls: the parents of the user's sprint Tasks (allIds) and those Tasks that are QA bugs (bugIds).
export interface SyncScope {
  allIds: number[];
  bugIds: number[];
  sprints: SprintRef[];
}
