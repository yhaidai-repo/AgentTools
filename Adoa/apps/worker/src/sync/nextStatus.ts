import type { PipelineStatus } from "@adoa/core";

const CLOSED_ADO_STATES = new Set(["Done", "Removed"]);
const NOT_YET_REFINED: PipelineStatus[] = ["new", "stale"];

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

  if (contentChanged && !NOT_YET_REFINED.includes(current)) {
    return "stale";
  }

  return current;
}
