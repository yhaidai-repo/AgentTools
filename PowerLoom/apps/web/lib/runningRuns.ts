import { loadRunningRunIds as loadRunningRunIdsOf, loadRunningRuns as loadRunningRunsOf } from "@powerloom/core";
import { getDb } from "./db";

// One agent's runs in progress in the selected vault (core's loadRunningRuns with the web's database).
export function loadRunningRuns(agentId: string, vault: string) {
  return loadRunningRunsOf(getDb(), agentId, vault);
}

// The ids of every run in progress in the selected vault.
export function loadRunningRunIds(vault: string) {
  return loadRunningRunIdsOf(getDb(), vault);
}
