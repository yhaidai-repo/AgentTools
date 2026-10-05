import type { PipelineStatus } from "@adoa/core";

const CLOSED_ADO_STATES = new Set(["Done", "Removed"]);
const NOT_YET_REFINED: PipelineStatus[] = ["new", "stale"];
// A finished PBI stays done when its ADO content changes; only ADO Done/Removed moves it (user decision 2026-10-05).
const NEVER_STALE: PipelineStatus[] = [...NOT_YET_REFINED, "done"];

export function isClosedAdoState(adoState: string): boolean {
  return CLOSED_ADO_STATES.has(adoState);
}

export function initialStatus(adoState: string): PipelineStatus {
  return isClosedAdoState(adoState) ? "closed" : "new";
}

// Sync-owned transitions; agents own all the others.
export function nextStatus(current: PipelineStatus, adoState: string, contentChanged: boolean): PipelineStatus {
  if (isClosedAdoState(adoState)) {
    return "closed";
  }

  if (current === "closed") {
    return "new";
  }

  if (contentChanged && !NEVER_STALE.includes(current)) {
    return "stale";
  }

  return current;
}
